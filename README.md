# ⚡ Voltoro MoCap Studio Pro
### Real-Time AI & Vision Motion Capture for Game Development (Unity C# & Unreal Engine)

Voltoro MoCap turns any mobile phone camera or web camera into a **real-time motion capture rig** that streams full-body joints and bone orientations directly into **Unity C#** and **Unreal Engine**, or exports standard animation takes as JSON/BVH.

---

## 🚀 Quick Start Guide

### Step 1: Start the Relay Server (for Unity / Unreal Stream)
In your terminal:
```bash
npm run relay
```
This launches the high-speed local WebSocket broadcast bridge on port `8080`.

### Step 2: Start the MoCap Web Studio (Accessible from your Phone)
In a second terminal:
```bash
npm run dev
```
Vite will print your local network address (e.g., `http://192.168.1.X:5173`).
Open that URL on your **Mobile Phone's browser** (Safari on iOS or Chrome on Android).

---

## 🎮 Unity C# Integration (Drop-in Ready)

1. In your Unity project, make sure you have a Humanoid Avatar character in your scene with an `Animator` component.
2. Copy [`VoltoroMoCapReceiver.cs`](file:///d:/Voltoro%20Mocap/unity-scripts/VoltoroMoCapReceiver.cs) into your Unity project's `Assets/Scripts/` folder.
3. Attach `VoltoroMoCapReceiver` to your character GameObject.
4. Set the `Relay Server Url` field:
   - If running Unity on the same PC: `ws://localhost:8080`
   - If running across the local network: `ws://<YOUR-PC-IP>:8080`
5. Press **Play** in Unity, then click **Start Camera** and **Connect to Unity/Unreal** in the MoCap Web app on your phone!

---

## 🤖 OpenRouter AI Animation Director
Integrated with OpenRouter using `qwen/qwen-2.5-72b-instruct` to:
- Direct your motion capture takes.
- Provide real-time advice on posture, T-Pose calibration, and tracking limits.
- Guide Unity C# avatar retargeting.

---

## 📦 What is Included in this Workspace

- **`index.html` & `src/`**: Three.js 3D skeleton visualizer, 33-point MediaPipe tracker, OneEuro smoothing jitter filter, and bone math engine.
- **`relay-server.js`**: Low-latency Node.js WebSocket broadcast relay.
- **`unity-scripts/VoltoroMoCapReceiver.cs`**: Production-ready C# receiver script for Unity Humanoid avatars with Slerp interpolation.
