/** Marketing Campaigns area UI copy — keyed by portal locale (`en` | `ar`). */
const MKT_CAMP_I18N = {
  en: {
    'money.sar': 'SAR {amount}',
    dash: '—',

    'campaign.default': 'Campaign',
    'campaign.untitled': 'Untitled Campaign',

    'status.all': 'All Statuses',
    'status.draft': 'Draft',
    'status.pending_approval': 'Pending Approval',
    'status.pending': 'Pending',
    'status.approved': 'Approved',
    'status.active': 'Active',
    'status.paused': 'Paused',
    'status.completed': 'Completed',
    'status.rejected': 'Rejected',
    'status.cancelled': 'Cancelled',

    'platform.meta': 'Meta',
    'platform.google_ads': 'Google Ads',
    'platform.tiktok': 'TikTok',
    'platform.snapchat': 'Snapchat',
    'platform.influencer': 'Influencer',
    'platform.offline': 'Offline',
    'platform.unknown': 'Unknown',

    'type.brand_awareness': 'Brand Awareness',
    'type.lead_generation': 'Lead Generation',
    'type.conversion': 'Conversion',
    'type.retention': 'Retention',
    'type.seasonal': 'Seasonal',
    'type.campaign': 'Campaign',

    'list.searchPlaceholder': 'Search campaigns...',
    'list.allWorkshops': 'All Workshops',
    'list.allBranches': 'All Branches',
    'list.newCampaign': 'New Campaign',
    'list.errLoad': 'Failed to load campaigns.',
    'list.pendingAdmin':
      '{count} campaign{plural} awaiting Super Admin approval — open review from Actions to see full details.',
    'list.pendingMarketing':
      '{count} of your campaigns are pending Super Admin approval. You cannot approve your own campaigns.',
    'list.loading': 'Loading campaigns...',
    'list.empty': 'No campaigns found',
    'list.createFirst': 'Create your first campaign',
    'list.th.campaign': 'Campaign',
    'list.th.workshop': 'Workshop',
    'list.th.branches': 'Branches',
    'list.th.platform': 'Platform',
    'list.th.type': 'Type',
    'list.th.budget': 'Budget',
    'list.th.spent': 'Spent',
    'list.th.revenue': 'Revenue',
    'list.th.status': 'Status',
    'list.th.actions': 'Actions',
    'list.action.reviewApprove': 'Review & approve',
    'list.action.reviewReject': 'Review & reject',
    'list.awaitingSa': 'Awaiting SA',
    'list.awaitingSaTitle': 'Awaiting Super Admin',
    'list.action.edit': 'Edit',
    'list.action.metrics': 'Update metrics',
    'list.action.pause': 'Pause',
    'list.action.activate': 'Activate',
    'list.action.delete': 'Delete',
    'list.confirmDelete': 'Delete campaign "{name}"?',
    'list.rejectReason': 'Reject reason for "{name}":',
    'list.errStatus': 'Status change failed.',
    'list.errDelete': 'Delete failed.',
    'list.errApprove': 'Approve failed.',
    'list.errReject': 'Reject failed.',
    'list.branchCount': '{count} branch(es)',
    'list.branchesCount': '{count} branches',

    'review.title': 'Review campaign for approval',
    'review.loading': 'Loading campaign details...',
    'review.lead':
      'Marketing submitted this campaign. Review complete details before approving or rejecting.',
    'review.campaign': 'Campaign',
    'review.status': 'Status',
    'review.workshop': 'Workshop',
    'review.branches': 'Branches',
    'review.platform': 'Platform',
    'review.type': 'Type',
    'review.budget': 'Budget',
    'review.spentRevenue': 'Spent / Revenue',
    'review.startDate': 'Start date',
    'review.endDate': 'End date',
    'review.createdBy': 'Created by',
    'review.notes': 'Notes',
    'review.cancel': 'Cancel',
    'review.reject': 'Reject',
    'review.approve': 'Approve campaign',

    'metrics.title': 'Campaign Metrics — {name}',
    'metrics.erpTitle': 'POS / ERP revenue — auto sync',
    'metrics.erpBody':
      "Pull invoice totals from ERP for this campaign's workshop/branches and date range. Or skip sync and type the same values manually in the section below.",
    'metrics.erpWarn':
      'Sync needs workshop/branches on the campaign. You can still enter POS/ERP revenue manually below.',
    'metrics.previewLoading': 'Loading...',
    'metrics.preview': 'Preview ERP',
    'metrics.syncing': 'Syncing...',
    'metrics.sync': 'Sync from POS/ERP',
    'metrics.manualTitle': 'Manual POS / ERP entry',
    'metrics.manualHint':
      'Use when sync is unavailable — saves to the same campaign fields',
    'metrics.adTitle': 'Ad platform metrics',
    'metrics.adHint': 'Meta, Google Ads, TikTok, etc.',
    'metrics.field.budgetSpent': 'Spent (SAR)',
    'metrics.hint.budgetSpent': 'Campaign spend / linked expenses',
    'metrics.field.revenueGenerated': 'POS/ERP Revenue (SAR)',
    'metrics.hint.revenueGenerated': 'Invoice sales total for this campaign',
    'metrics.field.leadsCount': 'Leads (customers)',
    'metrics.hint.leadsCount': 'Unique customers — manual if ERP unavailable',
    'metrics.field.conversionsCount': 'Conversions (orders)',
    'metrics.hint.conversionsCount':
      'Invoice/order count — manual if ERP unavailable',
    'metrics.field.impressions': 'Impressions',
    'metrics.hint.impressions': 'From Meta / Google Ads dashboard',
    'metrics.field.clicks': 'Clicks',
    'metrics.hint.clicks': 'From ad platform dashboard',
    'metrics.cancel': 'Cancel',
    'metrics.saving': 'Saving...',
    'metrics.save': 'Save Metrics',
    'metrics.errPreview': 'Could not load POS/ERP revenue.',
    'metrics.errSync': 'POS/ERP sync failed.',
    'metrics.errSave': 'Failed to update metrics.',
    'metrics.manualNote':
      'Manual POS/ERP values — click Save Metrics to apply (same as sync).',

    'form.titleEdit': 'Edit Campaign',
    'form.titleNew': 'New Campaign',
    'form.subtitle':
      'Create a marketing ad campaign with platform, budget, dates and branch targeting.',
    'form.back': 'Back to Campaigns',
    'form.name': 'Campaign Name *',
    'form.namePlaceholder': 'Campaign name',
    'form.platform': 'Platform',
    'form.type': 'Type',
    'form.startDate': 'Start Date',
    'form.endDate': 'End Date',
    'form.budget': 'Budget Allocated (SAR)',
    'form.targeting': 'Targeting',
    'form.workshop': 'Workshop',
    'form.workshopPlaceholder': 'Search and select workshop',
    'form.branches': 'Branches (select one or more for this campaign)',
    'form.branchesPlaceholderWorkshop': 'Search branches for selected workshop',
    'form.branchesPlaceholderFirst': 'Select a workshop first',
    'form.notes': 'Notes',
    'form.notesPlaceholder': 'Optional notes for this campaign',
    'form.cancel': 'Cancel',
    'form.saving': 'Saving...',
    'form.save': 'Save Campaign',
    'form.errDropdowns': 'Failed to load workshops/branches.',
    'form.errLoad': 'Campaign load failed.',
    'form.errName': 'Campaign name is required.',
    'form.errDates': 'End date must be on or after start date.',
    'form.submitted': 'Campaign submitted for Super Admin approval.',
    'form.errSave': 'Save failed.',

    'req.searchPlaceholder': 'Search requests...',
    'req.errLoad': 'Failed to load campaign requests',
    'req.defaultTitle': 'Marketing Request',
    'req.banner':
      'Workshop campaign requests appear here for Marketing and Super Admin. Marketing reviews the request; after approval the linked campaign still requires Super Admin approval on the Campaigns page.',
    'req.bannerAdminExtra': ' You can process requests and approve campaigns.',
    'req.loading': 'Loading campaign requests...',
    'req.empty': 'No campaign requests',
    'req.th.requestNumber': 'Request #',
    'req.th.title': 'Title',
    'req.th.portal': 'Portal',
    'req.th.tenant': 'Tenant',
    'req.th.user': 'User',
    'req.th.type': 'Type',
    'req.th.audience': 'Audience',
    'req.th.budget': 'Budget',
    'req.th.start': 'Start',
    'req.th.end': 'End',
    'req.th.status': 'Status',
    'req.th.actions': 'Actions',
    'req.action.view': 'View details',
    'req.action.approve': 'Approve',
    'req.action.reject': 'Reject',
    'req.prompt.approveNotes': 'Approval notes?',
    'req.prompt.approveDefault': 'Approved by marketing team',
    'req.alert.approved':
      'Request approved. A campaign draft was created and sent to Super Admin for final campaign approval.',
    'req.errApprove': 'Failed to approve request',
    'req.prompt.rejectReason': 'Reject reason?',
    'req.errReject': 'Failed to reject request',
    'req.detail.loading': 'Loading details...',
    'req.detail.requestNumber': 'Request Number',
    'req.detail.portal': 'Portal',
    'req.detail.tenantId': 'Tenant ID',
    'req.detail.tenantName': 'Tenant Name',
    'req.detail.userId': 'User ID',
    'req.detail.userName': 'User Name',
    'req.detail.requestType': 'Request Type',
    'req.detail.targetAudience': 'Target Audience',
    'req.detail.budgetRequested': 'Budget Requested',
    'req.detail.linkedCampaignId': 'Linked Campaign ID',
    'req.detail.desiredStart': 'Desired Start Date',
    'req.detail.desiredEnd': 'Desired End Date',
    'req.detail.status': 'Status',
    'req.detail.createdAt': 'Created At',
    'req.detail.reviewedBy': 'Reviewed By',
    'req.detail.reviewDate': 'Review Date',
    'req.detail.description': 'Description',
    'req.detail.noDescription': 'No description provided.',
    'req.detail.marketingNotes': 'Marketing Notes',
    'req.detail.rejectionReason': 'Rejection Reason',
    'req.detail.cancel': 'Cancel',
    'req.detail.reject': 'Reject',
    'req.detail.approve': 'Approve',

    'roi.totalSpent': 'Total Spent',
    'roi.totalRevenue': 'Total Revenue',
    'roi.overallRoi': 'Overall ROI',
    'roi.chartTitle': 'ROI by Platform (%)',
    'roi.performance': 'Campaign Performance',
    'roi.th.campaign': 'Campaign',
    'roi.th.platform': 'Platform',
    'roi.th.spent': 'Spent (SAR)',
    'roi.th.revenue': 'Revenue (SAR)',
    'roi.th.roi': 'ROI %',
    'roi.th.leads': 'Leads',
    'roi.th.conversions': 'Conversions',
    'roi.loading': 'Loading analytics...',
    'roi.empty': 'No campaign performance found',
    'roi.errLoad': 'Failed to load ROI analytics.',
    'roi.percent': '{value}%',
  },
  ar: {
    'money.sar': '{amount} ر.س',
    dash: '—',

    'campaign.default': 'حملة',
    'campaign.untitled': 'حملة بدون عنوان',

    'status.all': 'كل الحالات',
    'status.draft': 'مسودة',
    'status.pending_approval': 'بانتظار الاعتماد',
    'status.pending': 'معلّق',
    'status.approved': 'معتمد',
    'status.active': 'نشط',
    'status.paused': 'متوقف مؤقتاً',
    'status.completed': 'مكتمل',
    'status.rejected': 'مرفوض',
    'status.cancelled': 'ملغى',

    'platform.meta': 'ميتا',
    'platform.google_ads': 'إعلانات جوجل',
    'platform.tiktok': 'تيك توك',
    'platform.snapchat': 'سناب شات',
    'platform.influencer': 'مؤثر',
    'platform.offline': 'غير إلكتروني',
    'platform.unknown': 'غير معروف',

    'type.brand_awareness': 'الوعي بالعلامة',
    'type.lead_generation': 'توليد العملاء المحتملين',
    'type.conversion': 'تحويل',
    'type.retention': 'الاحتفاظ',
    'type.seasonal': 'موسمي',
    'type.campaign': 'حملة',

    'list.searchPlaceholder': 'البحث في الحملات...',
    'list.allWorkshops': 'كل الورش',
    'list.allBranches': 'كل الفروع',
    'list.newCampaign': 'حملة جديدة',
    'list.errLoad': 'تعذّر تحميل الحملات.',
    'list.pendingAdmin':
      '{count} حملة بانتظار اعتماد المشرف الأعلى — افتح المراجعة من الإجراءات لعرض التفاصيل الكاملة.',
    'list.pendingMarketing':
      '{count} من حملاتك بانتظار اعتماد المشرف الأعلى. لا يمكنك اعتماد حملاتك بنفسك.',
    'list.loading': 'جارٍ تحميل الحملات...',
    'list.empty': 'لا توجد حملات',
    'list.createFirst': 'أنشئ حملتك الأولى',
    'list.th.campaign': 'الحملة',
    'list.th.workshop': 'الورشة',
    'list.th.branches': 'الفروع',
    'list.th.platform': 'المنصة',
    'list.th.type': 'النوع',
    'list.th.budget': 'الميزانية',
    'list.th.spent': 'المُنفَق',
    'list.th.revenue': 'الإيراد',
    'list.th.status': 'الحالة',
    'list.th.actions': 'الإجراءات',
    'list.action.reviewApprove': 'مراجعة واعتماد',
    'list.action.reviewReject': 'مراجعة ورفض',
    'list.awaitingSa': 'بانتظار المشرف',
    'list.awaitingSaTitle': 'بانتظار المشرف الأعلى',
    'list.action.edit': 'تعديل',
    'list.action.metrics': 'تحديث المقاييس',
    'list.action.pause': 'إيقاف مؤقت',
    'list.action.activate': 'تفعيل',
    'list.action.delete': 'حذف',
    'list.confirmDelete': 'حذف الحملة "{name}"؟',
    'list.rejectReason': 'سبب رفض "{name}":',
    'list.errStatus': 'فشل تغيير الحالة.',
    'list.errDelete': 'فشل الحذف.',
    'list.errApprove': 'فشل الاعتماد.',
    'list.errReject': 'فشل الرفض.',
    'list.branchCount': '{count} فرع',
    'list.branchesCount': '{count} فروع',

    'review.title': 'مراجعة الحملة للاعتماد',
    'review.loading': 'جارٍ تحميل تفاصيل الحملة...',
    'review.lead':
      'قدّم التسويق هذه الحملة. راجع التفاصيل الكاملة قبل الاعتماد أو الرفض.',
    'review.campaign': 'الحملة',
    'review.status': 'الحالة',
    'review.workshop': 'الورشة',
    'review.branches': 'الفروع',
    'review.platform': 'المنصة',
    'review.type': 'النوع',
    'review.budget': 'الميزانية',
    'review.spentRevenue': 'المُنفَق / الإيراد',
    'review.startDate': 'تاريخ البدء',
    'review.endDate': 'تاريخ الانتهاء',
    'review.createdBy': 'أنشئت بواسطة',
    'review.notes': 'ملاحظات',
    'review.cancel': 'إلغاء',
    'review.reject': 'رفض',
    'review.approve': 'اعتماد الحملة',

    'metrics.title': 'مقاييس الحملة — {name}',
    'metrics.erpTitle': 'إيراد نقاط البيع / ERP — مزامنة تلقائية',
    'metrics.erpBody':
      'اسحب إجماليات الفواتير من ERP لورشة/فروع هذه الحملة ونطاق التاريخ. أو تخطَّ المزامنة وأدخل القيم يدوياً في القسم أدناه.',
    'metrics.erpWarn':
      'المزامنة تحتاج ورشة/فروعاً على الحملة. يمكنك مع ذلك إدخال إيراد نقاط البيع / ERP يدوياً أدناه.',
    'metrics.previewLoading': 'جارٍ التحميل...',
    'metrics.preview': 'معاينة ERP',
    'metrics.syncing': 'جارٍ المزامنة...',
    'metrics.sync': 'مزامنة من نقاط البيع / ERP',
    'metrics.manualTitle': 'إدخال يدوي لنقاط البيع / ERP',
    'metrics.manualHint':
      'استخدم عند تعذّر المزامنة — يُحفظ في نفس حقول الحملة',
    'metrics.adTitle': 'مقاييس منصة الإعلانات',
    'metrics.adHint': 'ميتا، إعلانات جوجل، تيك توك، إلخ.',
    'metrics.field.budgetSpent': 'المُنفَق (ر.س)',
    'metrics.hint.budgetSpent': 'إنفاق الحملة / المصروفات المرتبطة',
    'metrics.field.revenueGenerated': 'إيراد نقاط البيع / ERP (ر.س)',
    'metrics.hint.revenueGenerated': 'إجمالي مبيعات الفواتير لهذه الحملة',
    'metrics.field.leadsCount': 'العملاء المحتملون',
    'metrics.hint.leadsCount':
      'عملاء فريدون — يدوياً إذا كان ERP غير متاح',
    'metrics.field.conversionsCount': 'التحويلات (الطلبات)',
    'metrics.hint.conversionsCount':
      'عدد الفواتير/الطلبات — يدوياً إذا كان ERP غير متاح',
    'metrics.field.impressions': 'الظهور',
    'metrics.hint.impressions': 'من لوحة ميتا / إعلانات جوجل',
    'metrics.field.clicks': 'النقرات',
    'metrics.hint.clicks': 'من لوحة منصة الإعلانات',
    'metrics.cancel': 'إلغاء',
    'metrics.saving': 'جارٍ الحفظ...',
    'metrics.save': 'حفظ المقاييس',
    'metrics.errPreview': 'تعذّر تحميل إيراد نقاط البيع / ERP.',
    'metrics.errSync': 'فشلت مزامنة نقاط البيع / ERP.',
    'metrics.errSave': 'تعذّر تحديث المقاييس.',
    'metrics.manualNote':
      'قيم يدوية لنقاط البيع / ERP — انقر حفظ المقاييس للتطبيق (مثل المزامنة).',

    'form.titleEdit': 'تعديل الحملة',
    'form.titleNew': 'حملة جديدة',
    'form.subtitle':
      'أنشئ حملة إعلانية تسويقية مع المنصة والميزانية والتواريخ واستهداف الفروع.',
    'form.back': 'العودة إلى الحملات',
    'form.name': 'اسم الحملة *',
    'form.namePlaceholder': 'اسم الحملة',
    'form.platform': 'المنصة',
    'form.type': 'النوع',
    'form.startDate': 'تاريخ البدء',
    'form.endDate': 'تاريخ الانتهاء',
    'form.budget': 'الميزانية المخصصة (ر.س)',
    'form.targeting': 'الاستهداف',
    'form.workshop': 'الورشة',
    'form.workshopPlaceholder': 'ابحث واختر ورشة',
    'form.branches': 'الفروع (اختر فرعاً واحداً أو أكثر لهذه الحملة)',
    'form.branchesPlaceholderWorkshop': 'ابحث في فروع الورشة المحددة',
    'form.branchesPlaceholderFirst': 'اختر ورشة أولاً',
    'form.notes': 'ملاحظات',
    'form.notesPlaceholder': 'ملاحظات اختيارية لهذه الحملة',
    'form.cancel': 'إلغاء',
    'form.saving': 'جارٍ الحفظ...',
    'form.save': 'حفظ الحملة',
    'form.errDropdowns': 'تعذّر تحميل الورش/الفروع.',
    'form.errLoad': 'فشل تحميل الحملة.',
    'form.errName': 'اسم الحملة مطلوب.',
    'form.errDates': 'يجب أن يكون تاريخ الانتهاء في يوم البدء أو بعده.',
    'form.submitted': 'أُرسلت الحملة لاعتماد المشرف الأعلى.',
    'form.errSave': 'فشل الحفظ.',

    'req.searchPlaceholder': 'البحث في الطلبات...',
    'req.errLoad': 'تعذّر تحميل طلبات الحملات',
    'req.defaultTitle': 'طلب تسويقي',
    'req.banner':
      'تظهر هنا طلبات حملات الورش للتسويق والمشرف الأعلى. يراجع التسويق الطلب؛ وبعد الاعتماد ما زالت الحملة المرتبطة تحتاج اعتماد المشرف الأعلى في صفحة الحملات.',
    'req.bannerAdminExtra': ' يمكنك معالجة الطلبات واعتماد الحملات.',
    'req.loading': 'جارٍ تحميل طلبات الحملات...',
    'req.empty': 'لا توجد طلبات حملات',
    'req.th.requestNumber': 'رقم الطلب',
    'req.th.title': 'العنوان',
    'req.th.portal': 'البوابة',
    'req.th.tenant': 'المستأجر',
    'req.th.user': 'المستخدم',
    'req.th.type': 'النوع',
    'req.th.audience': 'الجمهور',
    'req.th.budget': 'الميزانية',
    'req.th.start': 'البدء',
    'req.th.end': 'الانتهاء',
    'req.th.status': 'الحالة',
    'req.th.actions': 'الإجراءات',
    'req.action.view': 'عرض التفاصيل',
    'req.action.approve': 'اعتماد',
    'req.action.reject': 'رفض',
    'req.prompt.approveNotes': 'ملاحظات الاعتماد؟',
    'req.prompt.approveDefault': 'معتمد من فريق التسويق',
    'req.alert.approved':
      'تم اعتماد الطلب. أُنشئت مسودة حملة وأُرسلت إلى المشرف الأعلى للاعتماد النهائي.',
    'req.errApprove': 'تعذّر اعتماد الطلب',
    'req.prompt.rejectReason': 'سبب الرفض؟',
    'req.errReject': 'تعذّر رفض الطلب',
    'req.detail.loading': 'جارٍ تحميل التفاصيل...',
    'req.detail.requestNumber': 'رقم الطلب',
    'req.detail.portal': 'البوابة',
    'req.detail.tenantId': 'معرّف المستأجر',
    'req.detail.tenantName': 'اسم المستأجر',
    'req.detail.userId': 'معرّف المستخدم',
    'req.detail.userName': 'اسم المستخدم',
    'req.detail.requestType': 'نوع الطلب',
    'req.detail.targetAudience': 'الجمهور المستهدف',
    'req.detail.budgetRequested': 'الميزانية المطلوبة',
    'req.detail.linkedCampaignId': 'معرّف الحملة المرتبطة',
    'req.detail.desiredStart': 'تاريخ البدء المطلوب',
    'req.detail.desiredEnd': 'تاريخ الانتهاء المطلوب',
    'req.detail.status': 'الحالة',
    'req.detail.createdAt': 'تاريخ الإنشاء',
    'req.detail.reviewedBy': 'راجع بواسطة',
    'req.detail.reviewDate': 'تاريخ المراجعة',
    'req.detail.description': 'الوصف',
    'req.detail.noDescription': 'لا يوجد وصف.',
    'req.detail.marketingNotes': 'ملاحظات التسويق',
    'req.detail.rejectionReason': 'سبب الرفض',
    'req.detail.cancel': 'إلغاء',
    'req.detail.reject': 'رفض',
    'req.detail.approve': 'اعتماد',

    'roi.totalSpent': 'إجمالي المُنفَق',
    'roi.totalRevenue': 'إجمالي الإيراد',
    'roi.overallRoi': 'العائد الإجمالي',
    'roi.chartTitle': 'العائد حسب المنصة (%)',
    'roi.performance': 'أداء الحملات',
    'roi.th.campaign': 'الحملة',
    'roi.th.platform': 'المنصة',
    'roi.th.spent': 'المُنفَق (ر.س)',
    'roi.th.revenue': 'الإيراد (ر.س)',
    'roi.th.roi': 'العائد %',
    'roi.th.leads': 'العملاء المحتملون',
    'roi.th.conversions': 'التحويلات',
    'roi.loading': 'جارٍ تحميل التحليلات...',
    'roi.empty': 'لا يوجد أداء حملات',
    'roi.errLoad': 'تعذّر تحميل تحليلات العائد.',
    'roi.percent': '{value}%',
  },
};

function humanizeFallback(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function mktCampT(locale, key, vars) {
  const pack = MKT_CAMP_I18N[locale] || MKT_CAMP_I18N.en;
  let text = pack[key] ?? MKT_CAMP_I18N.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} status
 */
export function mktCampStatusLabel(locale, status) {
  const value = String(status || 'draft').trim().toLowerCase();
  const key = `status.${value}`;
  const label = mktCampT(locale, key);
  return label === key ? humanizeFallback(status) : label;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} platform
 */
export function mktCampPlatformLabel(locale, platform) {
  const value = String(platform || 'unknown').trim().toLowerCase();
  const key = `platform.${value}`;
  const label = mktCampT(locale, key);
  return label === key ? humanizeFallback(platform) : label;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {string} type
 */
export function mktCampTypeLabel(locale, type) {
  const value = String(type || 'campaign').trim().toLowerCase();
  const key = `type.${value}`;
  const label = mktCampT(locale, key);
  return label === key ? humanizeFallback(type) : label;
}

/**
 * @param {'en'|'ar'|string} locale
 * @param {number|string} value
 */
export function mktCampMoney(locale, value) {
  const n = Number(value);
  const amount = (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
  return mktCampT(locale, 'money.sar', { amount });
}
