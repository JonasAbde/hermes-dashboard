// MCP Server control routes — append these to api/server.js
// or merge directly into the Express app

/*
To merge into server.js, add these routes after the existing /api/mcp route (~line 1830):

POST /api/mcp/:name/start  — start a configured MCP server
POST /api/mcp/:name/stop   — stop a running MCP server (SIGTERM)
GET  /api/mcp/:name/logs   — tail last 50 lines of MCP server log
*/
