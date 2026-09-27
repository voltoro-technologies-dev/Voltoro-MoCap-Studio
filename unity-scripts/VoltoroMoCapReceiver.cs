using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Voltoro.MoCap
{
    [System.Serializable]
    public class MoCapVector3
    {
        public float x;
        public float y;
        public float z;

        public Vector3 ToUnity()
        {
            // Note: Coordinate conversion (Flip Z / Y depending on coordinate system)
            return new Vector3(-x, y, z);
        }
    }

    [System.Serializable]
    public class MoCapQuaternion
    {
        public float x;
        public float y;
        public float z;
        public float w;

        public Quaternion ToUnity()
        {
            return new Quaternion(-x, y, z, -w);
        }
    }

    [System.Serializable]
    public class MoCapLandmark
    {
        public string name;
        public MoCapVector3 pos;
        public float visibility;
    }

    [System.Serializable]
    public class MoCapBoneRotation
    {
        public string bone;
        public MoCapQuaternion rot;
    }

    [System.Serializable]
    public class MoCapPacket
    {
        public string type;
        public long timestamp;
        public int frame;
        public MoCapVector3 rootPos;
        public List<MoCapLandmark> landmarks;
        public List<MoCapBoneRotation> bones;
    }

    /// <summary>
    /// Voltoro MoCap Live Receiver for Unity Humanoid Avatars.
    /// Connects via WebSocket to the Voltoro MoCap phone/web app and applies
    /// real-time full body motion capture directly to your Animator avatar or custom bones!
    /// </summary>
    public class VoltoroMoCapReceiver : MonoBehaviour
    {
        [Header("Connection Settings")]
        [Tooltip("The IP address of your Voltoro MoCap Relay Server (e.g., ws://localhost:8080 or ws://192.168.1.50:8080)")]
        public string relayServerUrl = "ws://localhost:8080";
        public bool autoConnectOnStart = true;
        public bool reconnectOnDisconnect = true;

        [Header("Target Avatar Rig")]
        [Tooltip("Leave empty to auto-detect Animator on this GameObject")]
        public Animator targetAnimator;
        public Transform hipsRoot;

        [Header("Filter & Smoothing")]
        [Range(1f, 30f)]
        public float smoothingSpeed = 15f;
        public float positionScale = 1.0f;
        public bool applyRootMotion = true;

        [Header("Debug Visualizer")]
        public bool showGizmos = true;
        public Color jointColor = Color.cyan;
        public Color boneColor = Color.yellow;

        private ClientWebSocket _webSocket;
        private CancellationTokenSource _cts;
        private readonly Queue<string> _messageQueue = new Queue<string>();
        private readonly object _lock = new object();
        private MoCapPacket _latestPacket;

        // Bone mapping dictionary
        private Dictionary<HumanBodyBones, Transform> _humanoidBones = new Dictionary<HumanBodyBones, Transform>();
        private Dictionary<HumanBodyBones, Quaternion> _initialRotations = new Dictionary<HumanBodyBones, Quaternion>();

        private void Start()
        {
            if (targetAnimator == null)
            {
                targetAnimator = GetComponent<Animator>();
            }

            CacheHumanoidBones();

            if (autoConnectOnStart)
            {
                ConnectToMoCap();
            }
        }

        private void CacheHumanoidBones()
        {
            if (targetAnimator == null || !targetAnimator.isHuman)
            {
                Debug.LogWarning("[Voltoro MoCap] No Humanoid Animator found. Receiver will store landmarks without rotating avatar bones.");
                return;
            }

            HumanBodyBones[] bonesToMap = new HumanBodyBones[]
            {
                HumanBodyBones.Hips,
                HumanBodyBones.Spine,
                HumanBodyBones.Chest,
                HumanBodyBones.Neck,
                HumanBodyBones.Head,
                HumanBodyBones.LeftUpperArm,
                HumanBodyBones.LeftLowerArm,
                HumanBodyBones.LeftHand,
                HumanBodyBones.RightUpperArm,
                HumanBodyBones.RightLowerArm,
                HumanBodyBones.RightHand,
                HumanBodyBones.LeftUpperLeg,
                HumanBodyBones.LeftLowerLeg,
                HumanBodyBones.LeftFoot,
                HumanBodyBones.RightUpperLeg,
                HumanBodyBones.RightLowerLeg,
                HumanBodyBones.RightFoot
            };

            foreach (var bone in bonesToMap)
            {
                Transform boneTransform = targetAnimator.GetBoneTransform(bone);
                if (boneTransform != null)
                {
                    _humanoidBones[bone] = boneTransform;
                    _initialRotations[bone] = boneTransform.localRotation;
                }
            }

            if (hipsRoot == null && _humanoidBones.ContainsKey(HumanBodyBones.Hips))
            {
                hipsRoot = _humanoidBones[HumanBodyBones.Hips];
            }
        }

        public async void ConnectToMoCap()
        {
            if (_webSocket != null && _webSocket.State == WebSocketState.Open)
            {
                Debug.Log("[Voltoro MoCap] Already connected.");
                return;
            }

            _cts = new CancellationTokenSource();
            _webSocket = new ClientWebSocket();

            try
            {
                Debug.Log($"[Voltoro MoCap] Connecting to {relayServerUrl}...");
                await _webSocket.ConnectAsync(new Uri(relayServerUrl), _cts.Token);
                Debug.Log("[Voltoro MoCap] Connected to Live MoCap Stream! Ready for capture.");
                _ = ReceiveLoop();
            }
            catch (Exception ex)
            {
                Debug.LogError($"[Voltoro MoCap] Connection failed: {ex.Message}");
                if (reconnectOnDisconnect)
                {
                    Invoke(nameof(ConnectToMoCap), 3f);
                }
            }
        }

        private async Task ReceiveLoop()
        {
            var buffer = new byte[1024 * 64];

            while (_webSocket != null && _webSocket.State == WebSocketState.Open)
            {
                try
                {
                    var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), _cts.Token);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closing", CancellationToken.None);
                        break;
                    }

                    string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    lock (_lock)
                    {
                        _messageQueue.Enqueue(message);
                    }
                }
                catch (Exception ex)
                {
                    Debug.LogWarning($"[Voltoro MoCap] Receive exception: {ex.Message}");
                    break;
                }
            }

            if (reconnectOnDisconnect && Application.isPlaying)
            {
                Debug.Log("[Voltoro MoCap] Reconnecting in 3 seconds...");
                await Task.Delay(3000);
                ConnectToMoCap();
            }
        }

        private void Update()
        {
            // Process latest queued packets
            lock (_lock)
            {
                while (_messageQueue.Count > 0)
                {
                    string json = _messageQueue.Dequeue();
                    try
                    {
                        _latestPacket = JsonUtility.FromJson<MoCapPacket>(json);
                    }
                    catch (Exception ex)
                    {
                        Debug.LogWarning("[Voltoro MoCap] Parse error: " + ex.Message);
                    }
                }
            }

            if (_latestPacket == null) return;

            ApplyMoCapDataToAvatar(_latestPacket);
        }

        private void ApplyMoCapDataToAvatar(MoCapPacket packet)
        {
            // 1. Root Position
            if (applyRootMotion && hipsRoot != null && packet.rootPos != null)
            {
                Vector3 targetRootPos = packet.rootPos.ToUnity() * positionScale;
                hipsRoot.position = Vector3.Lerp(hipsRoot.position, targetRootPos, Time.deltaTime * smoothingSpeed);
            }

            // 2. Bone Rotations
            if (packet.bones != null)
            {
                foreach (var boneData in packet.bones)
                {
                    HumanBodyBones boneType;
                    if (Enum.TryParse(boneData.bone, true, out boneType))
                    {
                        if (_humanoidBones.TryGetValue(boneType, out Transform boneTransform))
                        {
                            Quaternion targetRot = _initialRotations[boneType] * boneData.rot.ToUnity();
                            boneTransform.localRotation = Quaternion.Slerp(boneTransform.localRotation, targetRot, Time.deltaTime * smoothingSpeed);
                        }
                    }
                }
            }
        }

        private void OnDestroy()
        {
            _cts?.Cancel();
            _webSocket?.Dispose();
        }

        private void OnDrawGizmos()
        {
            if (!showGizmos || _latestPacket == null || _latestPacket.landmarks == null) return;

            Gizmos.color = jointColor;
            foreach (var lm in _latestPacket.landmarks)
            {
                Vector3 worldPt = transform.TransformPoint(lm.pos.ToUnity());
                Gizmos.DrawSphere(worldPt, 0.04f);
            }
        }
    }
}
