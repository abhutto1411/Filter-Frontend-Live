/** Display names for a CONNECT task (multi-assign chips or legacy single name). */
export function assigneeLine(task) {
    if (!task) return '';
    if (Array.isArray(task.assignees) && task.assignees.length) {
        return task.assignees.map((a) => a.name).filter(Boolean).join(' · ');
    }
    return task.assignedToName || '';
}
