import React from 'react';
import {
  Info,
  FileText,
  Target,
  ShoppingCart,
  Gift,
  CalendarClock,
  MonitorSmartphone,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

const STEPS = [
  {
    icon: FileText,
    title: 'Basic Information',
    body: 'Give the promotion a clear name, pick a Marketing Strategy and Promotion Type, then set the Discount Type (Percentage / Fixed) and value.',
  },
  {
    icon: Target,
    title: 'Targeting',
    body: 'Choose the Source & Target Workshops, the branches/stores where it applies, and any target zones. Leave broad to reach more customers.',
  },
  {
    icon: ShoppingCart,
    title: 'What the customer must buy (Trigger)',
    body: 'Set Products and/or Services to "Specific only" and search-select the items. Then pick a rule: ALL selected required, ANY selected, or entire-invoice discount.',
  },
  {
    icon: Gift,
    title: 'What the customer gets (Reward)',
    body: 'Optional. For a plain discount, leave Reward Type as "No reward". For Buy → Get, choose Free / Percentage / Fixed and search-select the reward items.',
  },
  {
    icon: CalendarClock,
    title: 'Rules & Validity',
    body: 'Set customer segment, minimum purchase, max usage count, and the start/end date-time window.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Customer Display & POS',
    body: 'Add invoice banner text and terms. Turn on "Show on POS Invoice" so it can auto-apply at checkout once approved.',
  },
  {
    icon: CheckCircle2,
    title: 'Save & Get Approved',
    body: 'Save as Draft to keep editing, or Submit for Approval. After Super Admin approves and you activate it, it auto-applies on eligible invoices — no code needed.',
  },
];

export default function PromotionGuide() {
  return (
    <aside className="mkp-form-guide" aria-label="How to create a promotion">
      <div className="mkp-guide-header">
        <Sparkles size={16} strokeWidth={2.2} />
        <span>How to create a promotion</span>
      </div>

      <div className="mkp-guide-intro">
        Follow these steps in order. Each step matches a section of the form on the left.
      </div>

      <ol className="mkp-guide-steps">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <li className="mkp-guide-step" key={step.title}>
              <span className="mkp-guide-step-num">{index + 1}</span>
              <div className="mkp-guide-step-body">
                <div className="mkp-guide-step-title">
                  <Icon size={14} strokeWidth={2} />
                  {step.title}
                </div>
                <p>{step.body}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mkp-guide-note">
        <Info size={14} strokeWidth={2} />
        <span>
          <b>Promotion vs Promo Code:</b> A <b>Promotion</b> auto-applies on eligible
          invoices after approval — no code. A <b>Promo Code</b> only applies when the
          cashier enters the code at POS.
        </span>
      </div>
    </aside>
  );
}
