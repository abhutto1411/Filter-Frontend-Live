import { apiFetch, BASE_URL, getAuthToken } from './api';

/**
 * FILTER CONNECT portal client.
 *
 * `askStream` deliberately does not use `apiFetch` — that helper parses the whole body as
 * JSON, which would defeat streaming. It also cannot use `EventSource`, because EventSource
 * has no way to send an Authorization header. So it calls `fetch` directly and reads the
 * SSE frames off the response body.
 */

const qs = (params = {}) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    });
    const s = sp.toString();
    return s ? `?${s}` : '';
};

export function getConnectScope(params = {}) {
    return apiFetch(`/connect/scope${qs(params)}`);
}

export function getConnectHome(params = {}) {
    return apiFetch(`/connect/home${qs(params)}`);
}

export function getAssistantStatus(params = {}) {
    return apiFetch(`/connect/assistant/status${qs(params)}`);
}

export function getAssistantHistory(params = {}) {
    return apiFetch(`/connect/assistant/history${qs(params)}`);
}

export function startNewAssistantSession(params = {}) {
    return apiFetch(`/connect/assistant/session/new${qs(params)}`, { method: 'POST' });
}

export function listAssistantSessions(params = {}) {
    return apiFetch(`/connect/assistant/sessions${qs(params)}`);
}

export function getAssistantSession(sessionId, params = {}) {
    return apiFetch(`/connect/assistant/sessions/${encodeURIComponent(sessionId)}${qs(params)}`);
}

export function resumeAssistantSession(sessionId, params = {}) {
    return apiFetch(`/connect/assistant/sessions/${encodeURIComponent(sessionId)}/resume${qs(params)}`, {
        method: 'POST',
    });
}

/** Build scope query params shared by home, status and assistant. */
export function connectScopeParams({ workshopId, branchId } = {}) {
    const params = {};
    if (workshopId) params.workshopId = workshopId;
    if (branchId) params.branchId = branchId;
    return params;
}

/**
 * @param {{ question: string, history?: {role: string, content: string}[], workshopId?: string, branchId?: string, signal?: AbortSignal }} params
 * @param {(event: object) => void} onEvent called for every server event as it arrives
 */
export async function askStream(
    { question, history = [], workshopId, branchId, inputMode, rawTranscript, editedTranscript, signal },
    onEvent,
) {
    const token = getAuthToken();

    const res = await fetch(`${BASE_URL}/connect/assistant/ask${qs({ workshopId, branchId })}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token.trim()}` } : {}),
        },
        body: JSON.stringify({ question, history, inputMode, rawTranscript, editedTranscript }),
        signal,
    });

    if (!res.ok) {
        let message = `Request failed (${res.status})`;
        try {
            const body = await res.json();
            message = body?.message || body?.error || message;
        } catch {
            // Non-JSON error body; keep the status message.
        }
        throw new Error(message);
    }
    if (!res.body) throw new Error('Streaming is not supported by this browser.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);

            for (const line of frame.split('\n')) {
                if (!line.startsWith('data:')) continue;
                const raw = line.slice(5).trim();
                if (!raw) continue;
                try {
                    onEvent(JSON.parse(raw));
                } catch {
                    // Ignore malformed frames rather than killing the stream.
                }
            }
        }
    }
}

export function getConnectAiConfig(params = {}) {
    return apiFetch(`/connect/ai/config${qs(params)}`);
}

export function patchConnectAiConfig(body, params = {}) {
    return apiFetch(`/connect/ai/config${qs(params)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export function listConnectAiProviders() {
    return apiFetch('/connect/ai/providers');
}

export function createConnectAiProvider(body) {
    return apiFetch('/connect/ai/providers', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function patchConnectAiProvider(id, body) {
    return apiFetch(`/connect/ai/providers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export function deleteConnectAiProvider(id) {
    return apiFetch(`/connect/ai/providers/${id}`, {
        method: 'DELETE',
    });
}

export function confirmConnectAction(actionId, params = {}) {
    return apiFetch(`/connect/assistant/confirm${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify({ actionId }),
    });
}

export function cancelConnectAction(actionId) {
    return apiFetch('/connect/assistant/cancel', {
        method: 'POST',
        body: JSON.stringify({ actionId }),
    });
}

export function sendConnectFeedback(sessionId, feedback) {
    return apiFetch('/connect/assistant/feedback', {
        method: 'POST',
        body: JSON.stringify({ sessionId, feedback }),
    });
}

export function listConnectKb(params = {}) {
    return apiFetch(`/connect/kb${qs(params)}`);
}

export function ingestConnectKb(body, params = {}) {
    return apiFetch(`/connect/kb${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function deleteConnectKb(id, params = {}) {
    return apiFetch(`/connect/kb/${id}${qs(params)}`, { method: 'DELETE' });
}

export function getConnectIntel(params = {}) {
    return apiFetch(`/connect/intel${qs(params)}`);
}

export function runConnectIntel() {
    return apiFetch('/connect/intel/run', { method: 'POST' });
}

export function listConnectTasks(params = {}) {
    return apiFetch(`/connect/tasks${qs(params)}`);
}

export function listConnectAssignees(params = {}) {
    return apiFetch(`/connect/assignees${qs(params)}`);
}

export function createConnectTask(body, params = {}) {
    return apiFetch(`/connect/tasks${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function getConnectTask(id, params = {}) {
    return apiFetch(`/connect/tasks/${id}${qs(params)}`);
}

export function patchConnectTask(id, body, params = {}) {
    return apiFetch(`/connect/tasks/${id}${qs(params)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export function deleteConnectTask(id, params = {}) {
    return apiFetch(`/connect/tasks/${id}${qs(params)}`, {
        method: 'DELETE',
    });
}

export function logConnectSpend(taskId, body, params = {}) {
    return apiFetch(`/connect/tasks/${taskId}/spend${qs(params)}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export function listConnectExpenses(params = {}) {
    return apiFetch(`/connect/expenses${qs(params)}`);
}

export function getConnectExpense(id, params = {}) {
    return apiFetch(`/connect/expenses/${id}${qs(params)}`);
}

export function linkConnectExpense(id, taskId, params = {}) {
    return apiFetch(`/connect/expenses/${id}/link${qs(params)}`, {
        method: 'PATCH',
        body: JSON.stringify({ taskId }),
    });
}

export function getConnectBudget(params = {}) {
    return apiFetch(`/connect/budget${qs(params)}`);
}

export async function transcribeAudio(blob) {
    const token = getAuthToken();
    const form = new FormData();
    form.append('audio', blob, 'voice.webm');
    const res = await fetch(`${BASE_URL}/connect/assistant/transcribe`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token.trim()}` } : {},
        body: form,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.message || 'Transcription failed');
    return body;
}

export async function analyseConnectAttachment(file, params = {}) {
    const token = getAuthToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE_URL}/connect/assistant/attachment${qs(params)}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token.trim()}` } : {},
        body: form,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.message || 'Could not read the file');
    return body;
}
