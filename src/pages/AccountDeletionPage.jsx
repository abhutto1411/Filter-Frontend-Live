import React, { useMemo, useState } from 'react';
import PublicLegalLayout from './PublicLegalLayout';

const SUPPORT_EMAIL = 'support@filtercarservices.com';

const CONTENT = {
    en: {
        title: 'Account Deletion',
        sections: [
            {
                heading: 'Request to delete your account',
                body: 'Filter Car Services ("Filter") lets you request deletion of your account and the personal data linked to it. This page explains how to submit a request, what data is removed, and what we may keep under Google Play and applicable law.',
            },
            {
                heading: 'How to request deletion',
                body: null,
                list: [
                    {
                        label: 'In the app',
                        items: [
                            'Open the Filter Car Services app and sign in.',
                            'Go to Profile → Settings → Delete account.',
                            'Follow the on-screen steps and confirm your request.',
                        ],
                    },
                    {
                        label: 'By email',
                        items: [
                            `Email ${SUPPORT_EMAIL} from the address or phone number registered on your account.`,
                            'Use the subject line: Account Deletion Request.',
                            'Include your full name, registered mobile number, and your role (e.g. technician, workshop owner, cashier).',
                        ],
                    },
                ],
            },
            {
                heading: 'Data that is deleted',
                body: 'After we verify your identity and approve the request, we delete or anonymize, where applicable:',
                bullets: [
                    'Account profile information (name, email, phone number).',
                    'Login credentials, active sessions, and device tokens.',
                    'In-app preferences and notification settings.',
                    'Personal chat content tied to your user account, where technically feasible.',
                ],
            },
            {
                heading: 'Data that may be retained',
                body: 'Some information may be kept when required for legal, tax, accounting, fraud prevention, or dispute resolution purposes, including:',
                bullets: [
                    'Completed service orders, invoices, commissions, and payment records.',
                    'Workshop or corporate records that must be kept for regulatory compliance.',
                    'Security and audit logs for a limited period.',
                    'Information that has been anonymized and no longer identifies you.',
                ],
                footer: 'Retention periods follow applicable laws in the Kingdom of Saudi Arabia and our internal policies (often up to 7 years for financial records where required).',
            },
            {
                heading: 'Processing time',
                body: 'We aim to complete verified deletion requests within 30 days. We will contact you if we need additional information to verify your identity.',
            },
            {
                heading: 'Questions',
                body: `If you have questions about this process, contact us at ${SUPPORT_EMAIL}.`,
            },
        ],
    },
    ar: {
        title: 'حذف الحساب',
        sections: [
            {
                heading: 'طلب حذف حسابك',
                body: 'تتيح لك فلتر لخدمات السيارات ("فلتر") طلب حذف حسابك والبيانات الشخصية المرتبطة به. توضح هذه الصفحة كيفية تقديم الطلب، والبيانات التي تُحذف، وما قد نحتفظ به وفق سياسة Google Play والقوانين المعمول بها.',
            },
            {
                heading: 'كيفية طلب الحذف',
                body: null,
                list: [
                    {
                        label: 'من داخل التطبيق',
                        items: [
                            'افتح تطبيق فلتر لخدمات السيارات وسجّل الدخول.',
                            'انتقل إلى الملف الشخصي ← الإعدادات ← حذف الحساب.',
                            'اتبع الخطوات على الشاشة وأكّد طلبك.',
                        ],
                    },
                    {
                        label: 'عبر البريد الإلكتروني',
                        items: [
                            `أرسل بريداً إلى ${SUPPORT_EMAIL} من البريد أو رقم الجوال المسجل في حسابك.`,
                            'استخدم عنوان الرسالة: Account Deletion Request.',
                            'اذكر اسمك الكامل ورقم الجوال المسجل ودورك (مثل: فني، مالك ورشة، كاشير).',
                        ],
                    },
                ],
            },
            {
                heading: 'البيانات التي تُحذف',
                body: 'بعد التحقق من هويتك والموافقة على الطلب، نحذف أو نُجهّل هوية — حيث ينطبق — ما يلي:',
                bullets: [
                    'معلومات الملف الشخصي (الاسم، البريد الإلكتروني، رقم الجوال).',
                    'بيانات تسجيل الدخول والجلسات النشطة ورموز الأجهزة.',
                    'تفضيلات التطبيق وإعدادات الإشعارات.',
                    'محتوى المحادثات الشخصية المرتبط بحسابك، حيثما أمكن تقنياً.',
                ],
            },
            {
                heading: 'البيانات التي قد نحتفظ بها',
                body: 'قد نحتفظ ببعض المعلومات عندما يقتضي القانون أو المحاسبة أو منع الاحتيال أو حل النزاعات ذلك، بما في ذلك:',
                bullets: [
                    'طلبات الخدمة المكتملة والفواتير والعمولات وسجلات الدفع.',
                    'سجلات الورشة أو الشركات التي يجب الاحتفاظ بها للامتثال التنظيمي.',
                    'سجلات الأمان والتدقيق لفترة محدودة.',
                    'معلومات تم إخفاء هويتها ولم تعد تحدد هويتك.',
                ],
                footer: 'تتبع فترات الاحتفاظ القوانين المعمول بها في المملكة العربية السعودية وسياساتنا الداخلية (غالباً حتى 7 سنوات للسجلات المالية عند الاقتضاء).',
            },
            {
                heading: 'مدة المعالجة',
                body: 'نسعى لإكمال طلبات الحذف الموثقة خلال 30 يوماً. سنتواصل معك إذا احتجنا معلومات إضافية للتحقق من هويتك.',
            },
            {
                heading: 'استفسارات',
                body: `لأي أسئلة حول هذه العملية، تواصل معنا على ${SUPPORT_EMAIL}.`,
            },
        ],
    },
};

function SectionBlock({ section }) {
    return (
        <section className="public-legal-section">
            <h2>{section.heading}</h2>
            {section.body && <p>{section.body}</p>}
            {section.list?.map((group) => (
                <div key={group.label} className="public-legal-subsection">
                    <h3>{group.label}</h3>
                    <ol>
                        {group.items.map((item) => (
                            <li key={item}>{item}</li>
                        ))}
                    </ol>
                </div>
            ))}
            {section.bullets && (
                <ul>
                    {section.bullets.map((item) => (
                        <li key={item}>{item}</li>
                    ))}
                </ul>
            )}
            {section.footer && <p className="public-legal-note">{section.footer}</p>}
        </section>
    );
}

export default function AccountDeletionPage() {
    const [locale, setLocale] = useState('en');
    const copy = useMemo(() => CONTENT[locale === 'ar' ? 'ar' : 'en'], [locale]);

    return (
        <PublicLegalLayout locale={locale} setLocale={setLocale}>
            <article className="public-legal-article">
                <h1>{copy.title}</h1>
                {copy.sections.map((section) => (
                    <SectionBlock key={section.heading} section={section} />
                ))}
            </article>
        </PublicLegalLayout>
    );
}
