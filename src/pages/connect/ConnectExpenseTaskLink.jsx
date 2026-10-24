import React, { useMemo, useState } from 'react';
import SearchableEntityCombobox from '../../components/SearchableEntityCombobox';

export default function ConnectExpenseTaskLink({ expense, tasks, onLink, disabled }) {
    const [query, setQuery] = useState('');

    const options = useMemo(() => {
        const workshopTasks = (tasks || []).filter((t) => !t.isStanding);
        const mapped = workshopTasks.map((t) => ({
            id: String(t.id),
            label: t.title,
            subtitle: [t.code || `TSK-${t.id}`, t.deadline].filter(Boolean).join(' · '),
            searchText: `${t.title} ${t.code || ''} TSK-${t.id}`,
        }));
        if (
            expense.taskId &&
            !mapped.some((o) => o.id === String(expense.taskId))
        ) {
            mapped.unshift({
                id: String(expense.taskId),
                label: expense.taskTitle || `TSK-${expense.taskId}`,
                subtitle: 'Currently linked',
                searchText: expense.taskTitle || '',
            });
        }
        return mapped;
    }, [tasks, expense.taskId, expense.taskTitle]);

    return (
        <div
            className="cn-expense-task-link"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <SearchableEntityCombobox
                className="cn-expense-task-combo"
                options={options}
                value={expense.taskId || ''}
                displayText={query}
                onDisplayTextChange={setQuery}
                onSelect={(opt) => {
                    if (!opt?.id || String(opt.id) === String(expense.taskId || '')) return;
                    setQuery('');
                    onLink(String(opt.id));
                }}
                placeholder={expense.taskTitle || 'Type to search tasks'}
                disabled={disabled}
                entityLabel="task"
                emptyHint="No matching workshop task"
                menuMinWidth={280}
            />
        </div>
    );
}
