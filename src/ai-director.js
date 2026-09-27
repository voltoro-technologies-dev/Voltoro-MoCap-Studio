export class OpenRouterMoCapAI {
  constructor(apiKey, model = 'qwen/qwen-2.5-72b-instruct') {
    this.apiKey = apiKey;
    this.model = model;
    this.apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
  }

  async askDirector(prompt, currentPoseData = null) {
    try {
      const messages = [
        {
          role: 'system',
          content: `You are the Voltoro MoCap Motion Capture Director & Animation Engineer for Unity and Unreal Engine.
You provide expert advice on motion capture recording, posture calibration, camera angle optimization, and C# avatar retargeting.
Keep your answers actionable, sharp, concise, and focused on practical game development.`
        }
      ];

      if (currentPoseData) {
        messages.push({
          role: 'user',
          content: `Current tracking stats: FrameCount: ${currentPoseData.frames}, FPS: ${currentPoseData.fps}, Bones tracked: ${currentPoseData.boneCount}.
Question/Request: ${prompt}`
        });
      } else {
        messages.push({
          role: 'user',
          content: prompt
        });
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://voltoro-mocap.local',
          'X-Title': 'Voltoro MoCap Game Studio'
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages,
          temperature: 0.7,
          max_tokens: 500
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter Error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0]?.message?.content || 'No response received from AI Director.';
    } catch (err) {
      console.error('MoCap AI Error:', err);
      return `Director Assistant Error: ${err.message}`;
    }
  }
}
