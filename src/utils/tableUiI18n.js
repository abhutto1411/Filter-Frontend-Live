const STRINGS = {
    en: {
        prev: 'Previous page',
        next: 'Next page',
        rowsPerPage: 'Rows per page',
        showing: 'Showing {from}–{to} of {total}',
        page: 'Page {page}',
        noMatches: 'No matches',
        moreMatches: 'More results — keep typing to narrow the list',
        loading: 'Loading…',
        typeToSearch: 'Type to search…',
        clear: 'Clear',
    },
    ar: {
        prev: 'الصفحة السابقة',
        next: 'الصفحة التالية',
        rowsPerPage: 'عدد الصفوف في الصفحة',
        showing: 'عرض {from}–{to} من {total}',
        page: 'صفحة {page}',
        noMatches: 'لا توجد نتائج مطابقة',
        moreMatches: 'توجد نتائج أخرى — تابع الكتابة لتضييق القائمة',
        loading: 'جارٍ التحميل…',
        typeToSearch: 'اكتب للبحث…',
        clear: 'مسح',
    },
};

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/** Built-in table/combo strings for `lang` ('en' | 'ar'). */
export function tableUiText(lang) {
    return STRINGS[lang === 'ar' ? 'ar' : 'en'];
}

/** `WsTablePagination` labels for `lang`. */
export function pagerLabels(lang) {
    const s = tableUiText(lang);
    return {
        prev: s.prev,
        next: s.next,
        rowsPerPage: s.rowsPerPage,
        showing: (from, to, total) => fill(s.showing, { from, to, total }),
        page: (n) => fill(s.page, { page: n }),
    };
}
