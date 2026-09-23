import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Copy, QrCode, Ticket } from 'lucide-react';
import QRCode from 'qrcode';
import { apiFetch } from '../services/api';
import { persistReferralCode, publicReferralSharePath } from '../utils/referralCodeCapture';

export default function PublicReferralLandingPage() {
  const { code: rawCode } = useParams();
  const scanned = decodeURIComponent(String(rawCode || '').trim());
  const [info, setInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  const [qrSrc, setQrSrc] = useState('');

  useEffect(() => {
    if (!scanned) return;
    persistReferralCode(scanned);
    let cancelled = false;
    apiFetch(`/public/referral/${encodeURIComponent(scanned)}`)
      .then((res) => {
        if (!cancelled) setInfo(res);
        if (res?.referralCode) persistReferralCode(res.referralCode);
      })
      .catch(() => {
        if (!cancelled) setInfo({ found: false, referralCode: scanned });
      });
    return () => {
      cancelled = true;
    };
  }, [scanned]);

  const displayCode = info?.referralCode || scanned;
  const valid = info?.found === true;
  const shareUrl =
    typeof window !== 'undefined' && displayCode
      ? `${window.location.origin}${publicReferralSharePath(displayCode)}`
      : '';

  useEffect(() => {
    if (!shareUrl) {
      setQrSrc('');
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(shareUrl, { width: 220, margin: 1, errorCorrectionLevel: 'M' })
      .then((src) => {
        if (!cancelled) setQrSrc(src);
      })
      .catch(() => {
        if (!cancelled) setQrSrc('');
      });
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  const copy = async () => {
    if (!displayCode) return;
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.icon}>
          <Ticket size={28} color="#B48A14" />
        </div>
        <p style={styles.kicker}>FILTER</p>
        <h1 style={styles.title}>Referral code</h1>
        <p style={styles.lead}>
          {valid
            ? `Show this code to the cashier at billing.`
            : scanned
              ? 'Give this code to the cashier. If it is valid, the visit is linked to the referrer.'
              : 'No referral code was provided.'}
        </p>
        {info?.referrerName ? (
          <p style={styles.muted}>Referred by {info.referrerName}</p>
        ) : null}
        <div style={styles.code}>{displayCode || '—'}</div>
        {qrSrc ? (
          <div style={styles.qrWrap}>
            <img src={qrSrc} alt={`QR code for ${displayCode}`} width={180} height={180} />
            <p style={styles.qrHint}>
              <QrCode size={14} /> Scan to open this referral link
            </p>
          </div>
        ) : null}
        {displayCode ? (
          <button type="button" style={styles.btn} onClick={copy}>
            <Copy size={16} />
            {copied ? 'Copied' : 'Copy code'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f7',
    padding: 24,
    fontFamily: 'Poppins, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    background: '#fff',
    borderRadius: 20,
    padding: '36px 28px',
    boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
    textAlign: 'center',
  },
  icon: {
    width: 56,
    height: 56,
    margin: '0 auto 12px',
    borderRadius: 16,
    background: 'rgba(252, 194, 71, 0.16)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    letterSpacing: '0.18em',
    fontSize: 11,
    fontWeight: 800,
    color: '#94a3b8',
    margin: 0,
  },
  title: {
    margin: '8px 0 6px',
    fontSize: 26,
    color: '#0f172a',
  },
  lead: {
    margin: '0 0 8px',
    color: '#64748b',
    fontSize: 14,
    lineHeight: 1.5,
  },
  muted: {
    margin: '0 0 16px',
    color: '#94a3b8',
    fontSize: 13,
  },
  code: {
    fontSize: 28,
    fontWeight: 800,
    letterSpacing: '0.08em',
    background: '#0f172a',
    color: '#fcc247',
    borderRadius: 14,
    padding: '14px 12px',
    marginBottom: 16,
  },
  qrWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    margin: '0 0 16px',
  },
  qrHint: {
    margin: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1.5px solid #e2e8f0',
    background: '#fff',
    borderRadius: 12,
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};
