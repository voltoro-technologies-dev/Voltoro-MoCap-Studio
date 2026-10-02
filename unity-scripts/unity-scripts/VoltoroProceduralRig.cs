using System;
using System.Collections.Generic;
using UnityEngine;

namespace Voltoro.MoCap
{
    /// <summary>
    /// Procedural Humanoid Rig Generator & Test Rig.
    /// If you do not have a 3D avatar imported yet, this script automatically builds
    /// a full humanoid joint skeleton with visible 3D mesh limbs in your scene at runtime
    /// and binds it directly to VoltoroMoCapReceiver so you can test immediately!
    /// </summary>
    public class VoltoroProceduralRig : MonoBehaviour
    {
        [Header("Appearance")]
        public Material jointMaterial;
        public Material boneMaterial;
        public Color jointColor = new Color(0f, 0.94f, 1f); // Neon Cyan
        public Color boneColor = new Color(1f, 1f, 1f, 0.9f);

        [Header("Bone Scale")]
        public float jointRadius = 0.035f;
        public float handJointRadius = 0.012f;
        public float boneRadius = 0.02f;
        public float handBoneRadius = 0.008f;

        private VoltoroMoCapReceiver _receiver;
        private Dictionary<int, Transform> _jointTransforms = new Dictionary<int, Transform>();
        private List<(int start, int end, Transform boneTr)> _boneSegments = new List<(int, int, Transform)>();

        private readonly List<(int, int)> _connections = new List<(int, int)>()
        {
            // Head & Face Body Landmarks
            (0, 1), (1, 2), (2, 3), (3, 7),
            (0, 4), (4, 5), (5, 6), (6, 8),
            (9, 10),
            // Torso
            (11, 12), // Shoulders
            (11, 23), (12, 24), // Torso sides
            (23, 24), // Hips
            // Left Arm
            (11, 13), (13, 15),
            // Right Arm
            (12, 14), (14, 16),
            // Left Leg
            (23, 25), (25, 27), (27, 29), (27, 31),
            // Right Leg
            (24, 26), (26, 28), (28, 30), (28, 32),
            // Left Hand Base & Fingers
            (15, 33), // Wrist to Left Hand Base
            (33, 34), (34, 35), (35, 36), (36, 37), // Thumb
            (33, 38), (38, 39), (39, 40), (40, 41), // Index
            (33, 42), (42, 43), (43, 44), (44, 45), // Middle
            (33, 46), (46, 47), (47, 48), (48, 49), // Ring
            (33, 50), (50, 51), (51, 52), (52, 53), // Pinky
            // Right Hand Base & Fingers
            (16, 54), // Wrist to Right Hand Base
            (54, 55), (55, 56), (56, 57), (57, 58), // Thumb
            (54, 59), (59, 60), (60, 61), (61, 62), // Index
            (54, 63), (63, 64), (64, 65), (65, 66), // Middle
            (54, 67), (67, 68), (68, 69), (69, 70), // Ring
            (54, 71), (71, 72), (72, 73), (73, 74)  // Pinky
        };

        private void Awake()
        {
            _receiver = GetComponent<VoltoroMoCapReceiver>();
            if (_receiver == null)
            {
                _receiver = gameObject.AddComponent<VoltoroMoCapReceiver>();
            }

            CreateMaterials();
            BuildProceduralSkeleton();
        }

        private void CreateMaterials()
        {
            if (jointMaterial == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                jointMaterial = new Material(shader);
                jointMaterial.color = jointColor;
                if (jointMaterial.HasProperty("_EmissionColor"))
                {
                    jointMaterial.EnableKeyword("_EMISSION");
                    jointMaterial.SetColor("_EmissionColor", jointColor * 0.6f);
                }
            }

            if (boneMaterial == null)
            {
                Shader shader = Shader.Find("Universal Render Pipeline/Lit") ?? Shader.Find("Standard");
                boneMaterial = new Material(shader);
                boneMaterial.color = boneColor;
            }
        }

        private void BuildProceduralSkeleton()
        {
            GameObject rigRoot = new GameObject("ProceduralSkeletonVisualizer");
            rigRoot.transform.SetParent(transform, false);

            // Create spheres for 75 main body and finger landmarks
            for (int i = 0; i < 75; i++)
            {
                GameObject jointObj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                jointObj.name = $"Joint_{i}";
                jointObj.transform.SetParent(rigRoot.transform, false);
                float radius = (i < 33) ? jointRadius : handJointRadius;
                jointObj.transform.localScale = Vector3.one * (radius * 2f);

                Destroy(jointObj.GetComponent<Collider>());

                var renderer = jointObj.GetComponent<MeshRenderer>();
                if (renderer != null) renderer.material = jointMaterial;

                _jointTransforms[i] = jointObj.transform;
            }

            // Create cylinders for bone segments
            foreach (var (start, end) in _connections)
            {
                GameObject boneObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                boneObj.name = $"Bone_{start}_{end}";
                boneObj.transform.SetParent(rigRoot.transform, false);

                Destroy(boneObj.GetComponent<Collider>());

                var renderer = boneObj.GetComponent<MeshRenderer>();
                if (renderer != null) renderer.material = boneMaterial;

                _boneSegments.Add((start, end, boneObj.transform));
            }
        }

        private void LateUpdate()
        {
            if (_receiver == null) return;

            var packet = _receiver.GetLatestPacket();
            if (packet == null || packet.landmarks == null || packet.landmarks.Count == 0) return;

            // Update Joint Positions (Body + Fingers up to 75 joints)
            for (int i = 0; i < packet.landmarks.Count && i < 75; i++)
            {
                var lm = packet.landmarks[i];
                if (lm.visibility < 0.05f) continue;

                if (_jointTransforms.TryGetValue(i, out Transform tr))
                {
                    Vector3 targetPos = lm.pos.ToUnity();
                    tr.localPosition = Vector3.Lerp(tr.localPosition, targetPos, Time.deltaTime * _receiver.smoothingSpeed);
                }
            }

            // Update Bone Cylinders between joints
            foreach (var (start, end, boneTr) in _boneSegments)
            {
                if (_jointTransforms.TryGetValue(start, out Transform p1) &&
                    _jointTransforms.TryGetValue(end, out Transform p2))
                {
                    Vector3 pos1 = p1.localPosition;
                    Vector3 pos2 = p2.localPosition;

                    Vector3 dir = pos2 - pos1;
                    float dist = dir.magnitude;

                    if (dist > 0.005f && dist < 1.8f)
                    {
                        boneTr.localPosition = (pos1 + pos2) * 0.5f;
                        boneTr.up = dir.normalized;
                        float radius = (start >= 33 || end >= 33) ? handBoneRadius : boneRadius;
                        boneTr.localScale = new Vector3(radius * 2f, dist * 0.5f, radius * 2f);
                        boneTr.gameObject.SetActive(true);
                    }
                    else
                    {
                        boneTr.gameObject.SetActive(false);
                    }
                }
            }
        }
    }
}
