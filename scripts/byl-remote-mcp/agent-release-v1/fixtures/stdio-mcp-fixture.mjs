// Isolated SDK end-to-end test fixture only; never shipped in release artifact.
import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';

const srv = new Server({name:'aicc-stdio-fixture',version:'1.0.0'}, {capabilities:{tools:{}}});
srv.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {name:'read_file',description:'isolated fixture read_file',
      inputSchema:{type:'object',properties:{path:{type:'string'}},additionalProperties:false}},
    {name:'set_config_value',description:'never accessible fixture mutation',
      inputSchema:{type:'object',properties:{},additionalProperties:false}}
  ]
}));
srv.setRequestHandler(CallToolRequestSchema, async request => {
  if (request.params.name !== 'read_file') {
    return {isError:true,content:[{type:'text',text:'UNKNOWN_TOOL'}]};
  }
  const path = request.params.arguments?.path;
  return {content:[{type:'text',text:'FAKE_MCP_RESULT:' + String(path ?? 'empty')}]};
});
await srv.connect(new StdioServerTransport());
