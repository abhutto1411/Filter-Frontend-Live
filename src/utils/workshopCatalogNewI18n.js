/** Workshop Master Catalog (new) UI — keyed by portal locale (`en` | `ar`). */
const WCN_I18N = {
    en: {
        'page.title': 'Master Catalog',
        'page.subtitle': 'Browse items and add them to workshop branches.',
        'page.noPermission': "You don't have permission to view any Master Catalog tabs.",

        'tab.departments': 'Departments',
        'tab.categories': 'Categories',
        'tab.products': 'Products',
        'tab.services': 'Services',

        'subTab.not_added': 'Not added',
        'subTab.added': 'Already added',

        'btn.refresh': 'Refresh',
        'btn.retry': 'Retry',
        'btn.clear': 'Clear',
        'btn.cancel': 'Cancel',
        'btn.add': 'Add',
        'btn.adding': 'Adding…',
        'btn.addToWorkshop': 'Add to my workshop',
        'btn.addSelected': 'Add Selected to branches…',
        'btn.selectAll': 'Select all',
        'btn.selecting': 'Selecting…',
        'btn.previous': 'Previous',
        'btn.next': 'Next',
        'btn.apply': 'Apply',

        'tip.selectAll': 'Select every row matching the current filters (all pages). Replaces the current selection for this tab.',

        'selected': 'Selected:',
        'readOnlyHint': '(read-only — no add permission)',

        'aria.dismiss': 'Dismiss',

        'status.inactive': 'Inactive',
        'badge.inWorkshop': 'In your workshop',
        'badge.alreadyAdded': 'Already added',
        'badge.readOnly': 'Read only',

        'label.department': 'Department',
        'label.category': 'Category',
        'label.product': 'Product',
        'label.service': 'Service',
        'label.typeProduct': 'PRODUCT',
        'label.typeService': 'SERVICE',
        'label.typeCategory': 'CATEGORY',

        'subtitle.masterDept': 'Master Department',
        'subtitle.deptNamed': '{name} department',
        'subtitle.masterCatalog': 'Master Catalog',

        'meta.categoriesCount': '{count} categories',
        'meta.kmType': 'KM type: {value}',
        'meta.created': 'Created {date}',
        'meta.vatMode': 'VAT mode: {mode}',
        'money.sar': 'SAR {amount}',
        'money.sarExVat': 'SAR {amount} · ex VAT',

        'branch.all': 'All branches',
        'branch.label': 'Branch',
        'branch.prefix': 'Branch:',
        'branch.withId': 'Branch {id}',
        'branch.fallback': 'Branch',

        'filter.allDepartments': 'All departments',
        'filter.allTypes': 'All types',
        'type.product': 'Product',
        'type.service': 'Service',

        'search.products': 'Search products…',
        'search.services': 'Search services…',

        'loading.catalog': 'Loading master catalog…',
        'loading.departments': 'Loading departments…',
        'loading.categories': 'Loading categories…',
        'loading.products': 'Loading products…',
        'loading.services': 'Loading services…',
        'loading.deps': 'Checking dependencies…',

        'empty.noDeptsAdded': 'No departments added for this branch.',
        'empty.noDeptsMatch': 'No departments match (not added).',
        'empty.noCatsAdded': 'No categories added for this branch.',
        'empty.noCatsMatch': 'No categories match (not added).',
        'empty.noProductsAdded': 'No products added for this branch.',
        'empty.noProductsMatch': 'No products match (not added).',
        'empty.noServicesAdded': 'No services added for this branch.',
        'empty.noServicesMatch': 'No services match (not added).',

        'err.loadDepts': 'Failed to load departments.',
        'err.loadCats': 'Failed to load categories.',
        'err.loadProducts': 'Failed to load products.',
        'err.loadServices': 'Failed to load services.',
        'err.loadAllProducts': 'Failed to load all matching products.',
        'err.loadAllServices': 'Failed to load all matching services.',
        'err.failedAdd': 'Failed to add.',
        'err.failedAddCats': 'Failed to add categories.',
        'err.failedAddProducts': 'Failed to add products.',
        'err.failedAddServices': 'Failed to add services.',
        'err.loadSelectedProducts': 'Failed to load selected products for adoption.',
        'err.loadSelectedServices': 'Failed to load selected services for adoption.',
        'err.couldNotLoadProducts': 'Could not load details for the selected products. Try refreshing the list.',
        'err.couldNotLoadServices': 'Could not load details for the selected services. Try refreshing the list.',
        'err.checkDeps': 'Could not check dependencies.',

        'resolveNote.products': 'Showing {shown} of {total} selected products. The rest were not found with the current filters (or were removed from the catalog).',
        'resolveNote.services': 'Showing {shown} of {total} selected services. The rest were not found with the current filters (or were removed from the catalog).',

        'page.of': 'Page {page} of {totalPages} · {total} total',
        'page.simple': 'Page {page}',
        'page.fullPage': ' · full page',
        'page.loadedMore': ' loaded — Next if more exist',
        'page.loaded': ' loaded',
        'page.mid': ' · {loaded}',

        'result.summary': 'Added: {added} · Skipped: {skipped}{suffix}',
        'result.alreadyInBranch': ' (already in branch)',
        'result.branchItems': '{branch}: {count} {kind} ({names}{ellipsis})',
        'result.alsoAdded': 'Also added {total} {noun} → {branchSummary}',
        'kind.departments': 'departments',
        'kind.categories': 'categories',
        'kind.products': 'products',
        'kind.services': 'services',
        'kind.department': 'department',
        'kind.category': 'category',
        'kind.product': 'product',
        'kind.service': 'service',

        'back.departments': 'Back to Departments',
        'back.categories': 'Back to Categories',
        'back.products': 'Back to Products',
        'back.services': 'Back to Services',

        'branchTarget.title': 'Add to which branches?',
        'branchTarget.allAccessible': 'All branches you can access',
        'branchTarget.allWorkshop': 'All branches in this workshop',
        'branchTarget.specific': 'Specific branches',
        'branchTarget.noneFound': 'No branches found. The backend will resolve to all active branches.',

        'catAdopt.titleOne': 'Add {count} category to branches',
        'catAdopt.titleMany': 'Add {count} categories to branches',
        'catAdopt.subtitle': 'Parent departments will be auto-adopted to the same branches if needed.',

        'catSel.title': 'Pick categories for each department',
        'catSel.subtitle': 'For each department you selected, choose which categories should be added. Each chosen branch gets the same selection.',
        'catSel.allCats': 'All categories',
        'catSel.pickCats': 'Pick categories',
        'catSel.noCats': 'No categories (department only)',
        'catSel.noCatsAvailable': 'No categories available for this department.',

        'deps.ok': 'Parent department/category already exists. Selected items will be added only to branches where they are missing.',
        'deps.willAlso': 'We will also add the following so the items fit in your workshop:',
        'deps.departments': 'Departments ({count})',
        'deps.categories': 'Categories ({count})',

        'prodAdopt.titleOne': 'Add {count} product to your workshop',
        'prodAdopt.titleMany': 'Add {count} products to your workshop',
        'prodAdopt.subtitle': 'Review dependencies, target branches, and optional critical stock thresholds.',
        'prodAdopt.criticalTitle': 'Critical stock (per product, per branch)',
        'prodAdopt.criticalHint': 'Optional alert threshold when each branch adopts. Leave blank for 0.',
        'prodAdopt.applyAll': 'Apply to all rows',
        'prodAdopt.criticalPh': 'Critical',
        'th.product': 'Product',
        'th.criticalStock': 'Critical Stock',

        'svcAdopt.titleOne': 'Add {count} service to your workshop',
        'svcAdopt.titleMany': 'Add {count} services to your workshop',
        'svcAdopt.subtitle': 'Review auto-adopted dependencies and choose target branches.',
        'svcAdopt.beingAdded': 'Services being added: {names}{more}.',
        'svcAdopt.andMore': ', and {n} more',
    },
    ar: {
        'page.title': 'الكتالوج الرئيسي',
        'page.subtitle': 'تصفّح العناصر وأضفها إلى فروع الورشة.',
        'page.noPermission': 'ليس لديك صلاحية لعرض أي تبويب من الكتالوج الرئيسي.',

        'tab.departments': 'الأقسام',
        'tab.categories': 'التصنيفات',
        'tab.products': 'المنتجات',
        'tab.services': 'الخدمات',

        'subTab.not_added': 'غير مضاف',
        'subTab.added': 'مضاف مسبقاً',

        'btn.refresh': 'تحديث',
        'btn.retry': 'إعادة المحاولة',
        'btn.clear': 'مسح',
        'btn.cancel': 'إلغاء',
        'btn.add': 'إضافة',
        'btn.adding': 'جاري الإضافة…',
        'btn.addToWorkshop': 'إضافة إلى ورشتي',
        'btn.addSelected': 'إضافة المحدد إلى الفروع…',
        'btn.selectAll': 'تحديد الكل',
        'btn.selecting': 'جاري التحديد…',
        'btn.previous': 'السابق',
        'btn.next': 'التالي',
        'btn.apply': 'تطبيق',

        'tip.selectAll': 'تحديد كل الصفوف المطابقة للفلاتر الحالية (كل الصفحات). يستبدل التحديد الحالي لهذا التبويب.',

        'selected': 'المحدد:',
        'readOnlyHint': '(للقراءة فقط — لا صلاحية إضافة)',

        'aria.dismiss': 'إغلاق',

        'status.inactive': 'غير نشط',
        'badge.inWorkshop': 'في ورشتك',
        'badge.alreadyAdded': 'مضاف مسبقاً',
        'badge.readOnly': 'للقراءة فقط',

        'label.department': 'قسم',
        'label.category': 'تصنيف',
        'label.product': 'منتج',
        'label.service': 'خدمة',
        'label.typeProduct': 'منتج',
        'label.typeService': 'خدمة',
        'label.typeCategory': 'تصنيف',

        'subtitle.masterDept': 'قسم رئيسي',
        'subtitle.deptNamed': 'قسم {name}',
        'subtitle.masterCatalog': 'الكتالوج الرئيسي',

        'meta.categoriesCount': '{count} تصنيفات',
        'meta.kmType': 'نوع الكيلومتر: {value}',
        'meta.created': 'أُنشئ {date}',
        'meta.vatMode': 'وضع الضريبة: {mode}',
        'money.sar': '{amount} ر.س',
        'money.sarExVat': '{amount} ر.س · قبل الضريبة',

        'branch.all': 'كل الفروع',
        'branch.label': 'فرع',
        'branch.prefix': 'الفرع:',
        'branch.withId': 'فرع {id}',
        'branch.fallback': 'فرع',

        'filter.allDepartments': 'كل الأقسام',
        'filter.allTypes': 'كل الأنواع',
        'type.product': 'منتج',
        'type.service': 'خدمة',

        'search.products': 'بحث في المنتجات…',
        'search.services': 'بحث في الخدمات…',

        'loading.catalog': 'جاري تحميل الكتالوج الرئيسي…',
        'loading.departments': 'جاري تحميل الأقسام…',
        'loading.categories': 'جاري تحميل التصنيفات…',
        'loading.products': 'جاري تحميل المنتجات…',
        'loading.services': 'جاري تحميل الخدمات…',
        'loading.deps': 'جاري التحقق من التبعيات…',

        'empty.noDeptsAdded': 'لا أقسام مضافة لهذا الفرع.',
        'empty.noDeptsMatch': 'لا أقسام مطابقة (غير مضافة).',
        'empty.noCatsAdded': 'لا تصنيفات مضافة لهذا الفرع.',
        'empty.noCatsMatch': 'لا تصنيفات مطابقة (غير مضافة).',
        'empty.noProductsAdded': 'لا منتجات مضافة لهذا الفرع.',
        'empty.noProductsMatch': 'لا منتجات مطابقة (غير مضافة).',
        'empty.noServicesAdded': 'لا خدمات مضافة لهذا الفرع.',
        'empty.noServicesMatch': 'لا خدمات مطابقة (غير مضافة).',

        'err.loadDepts': 'فشل تحميل الأقسام.',
        'err.loadCats': 'فشل تحميل التصنيفات.',
        'err.loadProducts': 'فشل تحميل المنتجات.',
        'err.loadServices': 'فشل تحميل الخدمات.',
        'err.loadAllProducts': 'فشل تحميل كل المنتجات المطابقة.',
        'err.loadAllServices': 'فشل تحميل كل الخدمات المطابقة.',
        'err.failedAdd': 'فشلت الإضافة.',
        'err.failedAddCats': 'فشل إضافة التصنيفات.',
        'err.failedAddProducts': 'فشل إضافة المنتجات.',
        'err.failedAddServices': 'فشل إضافة الخدمات.',
        'err.loadSelectedProducts': 'فشل تحميل المنتجات المحددة للتبنّي.',
        'err.loadSelectedServices': 'فشل تحميل الخدمات المحددة للتبنّي.',
        'err.couldNotLoadProducts': 'تعذّر تحميل تفاصيل المنتجات المحددة. حاول تحديث القائمة.',
        'err.couldNotLoadServices': 'تعذّر تحميل تفاصيل الخدمات المحددة. حاول تحديث القائمة.',
        'err.checkDeps': 'تعذّر التحقق من التبعيات.',

        'resolveNote.products': 'عرض {shown} من {total} منتجات محددة. الباقي غير موجود بالفلاتر الحالية (أو أُزيل من الكتالوج).',
        'resolveNote.services': 'عرض {shown} من {total} خدمات محددة. الباقي غير موجود بالفلاتر الحالية (أو أُزيل من الكتالوج).',

        'page.of': 'صفحة {page} من {totalPages} · الإجمالي {total}',
        'page.simple': 'صفحة {page}',
        'page.fullPage': ' · صفحة كاملة',
        'page.loadedMore': ' محمّل — التالي إن وُجد المزيد',
        'page.loaded': ' محمّل',
        'page.mid': ' · {loaded}',

        'result.summary': 'المضاف: {added} · المتجاوز: {skipped}{suffix}',
        'result.alreadyInBranch': ' (موجود مسبقاً في الفرع)',
        'result.branchItems': '{branch}: {count} {kind} ({names}{ellipsis})',
        'result.alsoAdded': 'أُضيف أيضاً {total} {noun} ← {branchSummary}',
        'kind.departments': 'أقسام',
        'kind.categories': 'تصنيفات',
        'kind.products': 'منتجات',
        'kind.services': 'خدمات',
        'kind.department': 'قسم',
        'kind.category': 'تصنيف',
        'kind.product': 'منتج',
        'kind.service': 'خدمة',

        'back.departments': 'العودة للأقسام',
        'back.categories': 'العودة للتصنيفات',
        'back.products': 'العودة للمنتجات',
        'back.services': 'العودة للخدمات',

        'branchTarget.title': 'الإضافة لأي فروع؟',
        'branchTarget.allAccessible': 'كل الفروع التي يمكنك الوصول إليها',
        'branchTarget.allWorkshop': 'كل فروع هذه الورشة',
        'branchTarget.specific': 'فروع محددة',
        'branchTarget.noneFound': 'لا فروع. سيُحلّها الخادم إلى كل الفروع النشطة.',

        'catAdopt.titleOne': 'إضافة تصنيف واحد ({count}) إلى الفروع',
        'catAdopt.titleMany': 'إضافة {count} تصنيفات إلى الفروع',
        'catAdopt.subtitle': 'ستُتبنّى الأقسام الأب تلقائياً لنفس الفروع عند الحاجة.',

        'catSel.title': 'اختر التصنيفات لكل قسم',
        'catSel.subtitle': 'لكل قسم حددته، اختر التصنيفات المراد إضافتها. يحصل كل فرع مختار على نفس التحديد.',
        'catSel.allCats': 'كل التصنيفات',
        'catSel.pickCats': 'اختيار تصنيفات',
        'catSel.noCats': 'بدون تصنيفات (القسم فقط)',
        'catSel.noCatsAvailable': 'لا تصنيفات متاحة لهذا القسم.',

        'deps.ok': 'القسم/التصنيف الأب موجود مسبقاً. ستُضاف العناصر المحددة فقط للفروع التي تنقصها.',
        'deps.willAlso': 'سنضيف أيضاً ما يلي حتى تناسب العناصر ورشتك:',
        'deps.departments': 'الأقسام ({count})',
        'deps.categories': 'التصنيفات ({count})',

        'prodAdopt.titleOne': 'إضافة منتج واحد ({count}) إلى ورشتك',
        'prodAdopt.titleMany': 'إضافة {count} منتجات إلى ورشتك',
        'prodAdopt.subtitle': 'راجع التبعيات والفروع المستهدفة وحدود المخزون الحرج الاختيارية.',
        'prodAdopt.criticalTitle': 'المخزون الحرج (لكل منتج، لكل فرع)',
        'prodAdopt.criticalHint': 'حد تنبيه اختياري عند تبنّي كل فرع. اتركه فارغاً للصفر.',
        'prodAdopt.applyAll': 'تطبيق على كل الصفوف',
        'prodAdopt.criticalPh': 'حرج',
        'th.product': 'المنتج',
        'th.criticalStock': 'المخزون الحرج',

        'svcAdopt.titleOne': 'إضافة خدمة واحدة ({count}) إلى ورشتك',
        'svcAdopt.titleMany': 'إضافة {count} خدمات إلى ورشتك',
        'svcAdopt.subtitle': 'راجع التبعيات المتبنّاة تلقائياً واختر الفروع المستهدفة.',
        'svcAdopt.beingAdded': 'الخدمات قيد الإضافة: {names}{more}.',
        'svcAdopt.andMore': '، و{n} المزيد',
    },
};

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function wcnT(locale, key, vars) {
    const pack = WCN_I18N[locale] || WCN_I18N.en;
    let text = pack[key] ?? WCN_I18N.en[key] ?? key;
    if (vars) {
        for (const [k, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${k}}`, String(v));
        }
    }
    return text;
}
