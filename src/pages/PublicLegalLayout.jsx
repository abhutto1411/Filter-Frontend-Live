import React from 'react';
import { Link } from 'react-router-dom';
import filterBrandIcon from '../assets/images/filter-brand-icon.png';
import './PublicLegalPage.css';

export default function PublicLegalLayout({ locale, setLocale, children }) {
    const isAr = locale === 'ar';

    return (
        <div className="public-legal-page" dir={isAr ? 'rtl' : 'ltr'}>
            <header className="public-legal-header">
                <Link to="/" className="public-legal-brand" aria-label="Filter Car Services home">
                    <img
                        src={filterBrandIcon}
                        alt=""
                        className="public-legal-brand-icon"
                        width={140}
                        height={48}
                    />
                    <span className="public-legal-tag">Car Services</span>
                </Link>
                <div className="public-legal-lang">
                    <button
                        type="button"
                        className={locale === 'en' ? 'is-active' : ''}
                        onClick={() => setLocale('en')}
                    >
                        EN
                    </button>
                    <button
                        type="button"
                        className={locale === 'ar' ? 'is-active' : ''}
                        onClick={() => setLocale('ar')}
                    >
                        عربي
                    </button>
                </div>
            </header>

            <main className="public-legal-main">{children}</main>
        </div>
    );
}
