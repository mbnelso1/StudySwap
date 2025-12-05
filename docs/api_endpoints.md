# API Endpoint Reference
For each of your major endpoints, provide the following:
### `GET /api/resource`
* **Description:** Retrieves a list of all resources.
* **Example Request:** `curl http://localhost:3000/api/resource`
* **Example Response (200 OK):**
```json
[ { "id": "...", ... }, ... ]
```
---
### `POST /api/resource`
* **Description:** Creates a new resource.
* **Example Request Body:**
```json
{ "name": "...", "value": "..." }
```
* **Example Response (201 Created):**
```json
{ "id": "...", "name": "...", "value": "..." }
