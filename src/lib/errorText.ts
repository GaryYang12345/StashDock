// The text a person sees for a failure: the message itself, never its wrapping
// ("Error: ", "McpError: ") or raw protocol codes ("MCP error -32001: ...").
// Messages from StashDock's own commands and tools are already written for
// people and pass through unchanged, so the shared catalog can translate them.
export const COMPOSER_UNAVAILABLE = 'The ChatGPT input box is not available. Open a conversation, then add again.';
const TIMED_OUT = 'The request took too long. Try again.';
const DISCONNECTED = 'The connection to StashDock was lost. Retry the connection.';
const FAILED = 'The request could not be completed. Try again.';

export function errorText(reason: unknown, fallback = 'The request failed. Please retry.'): string {
  const raw = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : '';
  const text = raw.replace(/^(?:[A-Za-z]*Error:\s*)+/, '').trim();
  // Host and transport failures, as the MCP SDK reports them.
  const protocol = /^MCP error (-?\d+):\s*/i.exec(text);
  if (!protocol) return text || fallback;
  const detail = text.slice(protocol[0].length);
  if (/composer is unavailable|composer.+not available/i.test(detail)) return COMPOSER_UNAVAILABLE;
  if (protocol[1] === '-32001' || /timed? ?out/i.test(detail)) return TIMED_OUT;
  if (/connection closed|not connected|disconnected/i.test(detail)) return DISCONNECTED;
  return FAILED;
}
