import PendingRequests from './PendingRequests';

/** Collector portal — open collectible cash (workshop-wide unless branch filter set). */
export default function CollectibleCash(props) {
    return <PendingRequests {...props} view="collector" layout="cards" />;
}