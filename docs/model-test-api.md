# Model Test API

## Endpoint
- `POST /models/test/`

## Description
Test up to 3 LLM models simultaneously with the same prompt. This endpoint streams each model's response (processed sequentially) so you can compare outputs without persisting the conversation.

## Authentication
- Requires authentication (backend uses `@require_auth`).

## Request Body
```json
{
  "modelIds": [1, 2, 3],
  "message": "What is the capital of France?",
  "systemPrompt": "You are a helpful geography tutor.",
  "chatHistory": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous response" }
  ]
}
```

### Parameters
| Parameter     | Type   | Required | Description                                         |
|---------------|--------|----------|-----------------------------------------------------|
| `modelIds`    | array  | Yes      | Array of 1–3 model IDs to test                      |
| `message`     | string | Yes      | User's test message/prompt                          |
| `systemPrompt`| string | No       | Optional system prompt to guide model behavior      |
| `chatHistory` | array  | No       | Optional previous conversation turns for context    |

### Validation Rules
- `message` must not be empty.
- `modelIds` must be a non-empty array.
- Minimum 1 model, maximum 3 models.
- All model IDs must exist in the database.

## Response Format (SSE)
The endpoint returns a Server-Sent Events (SSE) stream. Event types and payloads:

### `metadata`
Sent when a model starts processing.
```json
{
  "modelId": "1",
  "modelName": "GPT-4",
  "provider": "OpenAI"
}
```

### `start`
Model has started generating.
```json
{ "modelId": "1" }
```

### `chunk`
Streaming content from the model.
```json
{
  "modelId": "1",
  "delta": "The capital"
}
```

### `end`
Model finished generating.
```json
{ "modelId": "1" }
```

### `done`
Complete response with token usage.
```json
{
  "modelId": "1",
  "response": "The capital of France is Paris.",
  "inputTokens": 15,
  "outputTokens": 8
}
```

### `error`
Error during processing.
```json
{
  "modelId": "1",
  "error": "Rate limit exceeded"
}
```

### `complete`
All models have finished.
```json
{ "message": "All models completed" }
```

## Example Usage

### JavaScript/TypeScript (frontend)
```ts
const eventSource = new EventSource('/models/test/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer <token>'
  },
  body: JSON.stringify({
    modelIds: [1, 2, 3],
    message: 'Explain quantum computing in simple terms',
    systemPrompt: 'You are a helpful science educator'
  })
});

const responses: Record<string, any> = {};

eventSource.addEventListener('metadata', (e) => {
  const data = JSON.parse(e.data);
  responses[data.modelId] = {
    modelName: data.modelName,
    provider: data.provider,
    content: ''
  };
});

eventSource.addEventListener('chunk', (e) => {
  const data = JSON.parse(e.data);
  responses[data.modelId].content += data.delta;
  // Update UI with streaming content
});

eventSource.addEventListener('done', (e) => {
  const data = JSON.parse(e.data);
  responses[data.modelId].inputTokens = data.inputTokens;
  responses[data.modelId].outputTokens = data.outputTokens;
});

eventSource.addEventListener('complete', () => {
  eventSource.close();
  console.log('All models completed:', responses);
});

eventSource.addEventListener('error', (e) => {
  const data = JSON.parse(e.data);
  console.error('Error from model', data.modelId, ':', data.error);
});
```

### Python (testing)
```python
import requests
import json

url = 'http://localhost:8000/models/test/'
headers = {
    'Authorization': 'Bearer <token>',
    'Content-Type': 'application/json'
}
payload = {
    'modelIds': [1, 2],
    'message': 'What is machine learning?',
    'systemPrompt': 'You are a technical educator.'
}

response = requests.post(url, headers=headers, json=payload, stream=True)

for line in response.iter_lines():
    if line and line.startswith(b'data: '):
        data = json.loads(line[6:])
        print(data)
```

## Implementation Notes
- Models are invoked sequentially to avoid rate limits, simplify tracking, and keep responses distinct.
- No data is persisted: no chat history, token usage, or quotas are updated.

## Error Responses (400)
- `"message is required"`
- `"modelIds must be a non-empty array"`
- `"maximum 3 models allowed"`
- `"at least 1 model required"`
- `"Invalid model ID: <id>"`

## Related Endpoints
- `POST /personas/test/` — temporary persona testing.
- `GET /get_models/` — list available models.
- `POST /chat/turn/` — regular chat with persistence.
