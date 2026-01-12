# Flowting AI Backend API

This README lists the HTTP requests, request payloads, and responses found in the codebase.

## Auth and CSRF

- GET /api/csrf-init/
  - Response: {"detail": "CSRF cookie set"}
- GET /login/
  - Response: {"csrfToken": "..."}
- POST /login/
  - Request JSON: {"username"?: "...", "email"?: "...", "password": "..."}
  - Response 200: {"message": "Login successful", "user": {"id": 1, "username": "...", "firstName": "...", "lastName": "...", "email": "...", "phoneNumber": "..."}}
- GET /signup/
  - Response: {"csrfToken": "..."}
- POST /signup/
  - Request JSON: {"username": "...", "email": "...", "password": "...", "firstName"?: "...", "lastName"?: "...", "phoneNumber"?: "..."}
  - Response 201: {"message": "Signup successful", "user": {"id": 1, "username": "...", "email": "...", "firstName": "...", "lastName": "...", "phoneNumber": "..."}}

## Account

- GET /get_models and /get_models/
  - Response: [
      {"id": 1, "companyName": "...", "modelName": "...", "planType": "...", "inputLimit": 0, "outputLimit": 0,
       "callType": "...", "sdkLibrary": "...", "huggingfaceProvider": "...", "deploymentName": "...",
       "inputModalities": [], "outputModalities": [], "providerId": 1}
    ]
- GET /tokens/
  - Response: {"availableTokens": 0, "totalTokensUsed": 0}
- GET /user/
  - Response: {"id": "...", "username": "...", "name": "...", "firstName": "...", "lastName": "...", "email": "...",
               "planName": "...", "availableTokens": 0, "totalTokensUsed": 0}

## Chats and Messages

- GET /chats/
  - Response: {"csrfToken": "...", "chats": [{"id": "...", "title": "...", "created_at": "...", "updated_at": "...",
               "metadata": {"messageCount": 0, "lastMessageAt": "...", "lastModelName": "...", "lastProviderName": "...",
               "pinCount": 0, "starred": false, "starMessageId": null}}]}
- POST /chats/
  - Request JSON: {"firstMessage": "...", "model"?: {"modelId"?: 1, "caller"?: "..."}, "pinIds"?: ["..."], "context"?: {"intent": "CHAT"}}
  - Response 201: {"chat": {"id": "...", "title": "...", "response": "...", "messageId": "..."},
                   "message": {"response": "...", "message_id": "...", "prompt": "...", "metadata": {...}, "rag_metadata"?: {...}}}
- GET /chats/<chat_id>/messages/
  - Response: [{"id": "...", "prompt": "...", "response": "...", "model_name": "...", "provider_name": "...",
               "llm_model_id": 1, "input_tokens": 0, "output_tokens": 0, "created_at": "...", "metadata": {...}}]
- POST /chat/
  - Request JSON: {"prompt": "...", "chatId": "...", "model"?: {"modelId"?: 1, "caller"?: "..."}, "pinIds"?: ["..."],
                   "context"?: {...}, "useFramework"?: true, "constraints"?: {...}}
  - Response: {"message": "...", "messageId": "...", "prompt": "...", "metadata": {...}, "ragMetadata"?: {...},
               "frameworkDetails"?: {...}, "individualResponses"?: [...], "selectedModels"?: [...]}
- PATCH /chats/<chat_id>/messages/<message_id>/edit/
  - Request JSON: {"prompt": "...", "model"?: {"modelId"?: 1, "caller"?: "..."}, "pinIds"?: ["..."], "context"?: {...}}
  - Response: {"message": "...", "messageId": "...", "prompt": "...", "metadata": {...}, "deleted": 0,
               "deletedMessageIds": [], "ragMetadata"?: {...}}
- DELETE /chats/<chat_id>/
  - Response: {"deleted": true, "chat_id": "...", "message": "Chat deleted successfully"}
- DELETE /chats/<chat_id>/messages/<message_id>/
  - Response: {"deleted_count": 0, "deleted_message_ids": [], "message": "Deleted 0 message(s)", "chat_deleted": false}
- PATCH /chats/<chat_id>/star/
  - Request JSON: {"starred": true}
  - Response: {"chatId": "...", "starred": true, "starMessageId": null}
- POST /framework/route/
  - Request JSON: {"prompt": "...", "constraints"?: {...}}
  - Response: {"prompt": "...", "routing": {"model_id": 1, "model_name": "...", "deployment_name": "...", "provider": "..."}}

## Pins

- GET /chats/<chat_id>/pins/
  - Response: [{"id": "...", "chat": null, "sourceChatId": "...", "sourceMessageId": "...", "folderId": "...",
               "folderName": "...", "title": "...", "content": "...", "tags": [], "comments": [],
               "formattedContent": "...", "model_name": "...", "created_at": "..."}]
- POST /chats/<chat_id>/pins/
  - Request JSON: {"messageId": "...", "folderId"?: "...", "tags"?: ["..."], "comments"?: []}
  - Response 201: <serialize_pin payload, same shape as GET>
- GET /pins/
  - Response: [<serialize_pin payload>]
- PATCH /pins/<pin_id>/
  - Request JSON: {"folderId"?: "...", "tags"?: ["..."], "comments"?: []}
  - Response: <serialize_pin payload>
- DELETE /pins/<pin_id>/
  - Response: 204 No Content
- GET /pin-folders/
  - Response: [{"id": "...", "name": "...", "created_at": "...", "updated_at": "...", "isDefault": false,
               "pins": [<serialize_pin payload>]}]
- POST /pin-folders/
  - Request JSON: {"name": "..."}
  - Response 201: {"id": "...", "name": "...", "created_at": "...", "updated_at": "...", "isDefault": false}
- PATCH /pin-folders/<folder_id>/
  - Request JSON: {"name": "..."}
  - Response: {"id": "...", "name": "...", "created_at": "...", "updated_at": "...", "isDefault": false}
- DELETE /pin-folders/<folder_id>/
  - Response: 204 No Content
- GET /pin-folders/ids/
  - Response: [{"id": "...", "name": "...", "pinIds": ["..."]}]
