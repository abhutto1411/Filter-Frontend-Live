import React from 'react';

/**
 * Catches render errors in Staff App panels so one broken tab does not white-screen the portal.
 */
export default class StaffAppPanelErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, info) {
        console.error('[StaffAppPanelErrorBoundary]', error, info?.componentStack);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }

    render() {
        if (this.state.error) {
            return (
                <div
                    className="staff-app-table-wrap"
                    style={{ padding: 20, borderColor: '#fecaca', background: '#fef2f2' }}
                >
                    <h3 style={{ margin: '0 0 8px', color: '#991b1b' }}>
                        This screen could not be loaded
                    </h3>
                    <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: '#7f1d1d' }}>
                        {this.state.error?.message || 'An unexpected error occurred.'}
                    </p>
                    <button
                        type="button"
                        className="staff-app-btn staff-app-btn--primary"
                        onClick={() => this.setState({ error: null })}
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
