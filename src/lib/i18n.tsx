import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const translations = {
  en: {
    // Nav & General
    'app.name': 'PodChat',
    'app.tagline': 'Talk to your podcasts',
    'nav.home': 'Home',
    'nav.settings': 'Settings',
    'nav.back': 'Back',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.next': 'Next',
    'common.previous': 'Previous',
    'common.confirm': 'Confirm',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.export': 'Export',
    'common.import': 'Import',
    'common.retry': 'Retry',
    'common.send': 'Send',
    'common.close': 'Close',
    'common.loading': 'Loading...',
    'common.testConnection': 'Test Connection',
    'common.connected': 'Connected',
    'common.failed': 'Failed',

    // Home
    'home.title': 'Your Podcasts',
    'home.newPodcast': 'New Podcast',
    'home.empty': 'No podcasts yet',
    'home.emptyDesc': 'Upload your first podcast and start chatting with AI hosts.',
    'home.duration': 'Duration',
    'home.created': 'Created',
    'home.aiHost': 'AI Host',
    'home.status.ready': 'Ready',
    'home.status.configuring': 'Configuring',
    'home.listen': 'Listen',
    'home.chat': 'Chat',
    'home.summary': 'Summary',
    'home.continueSetup': 'Continue Setup',

    // Settings
    'settings.title': 'Settings',
    'settings.subtitle': 'Configure your API keys and preferences',
    'settings.elevenlabs': 'ElevenLabs',
    'settings.elevenlabsDesc': 'Voice recognition, cloning, TTS & conversational AI',
    'settings.firecrawl': 'Firecrawl',
    'settings.firecrawlDesc': 'Web content crawling for knowledge base',
    'settings.llm': 'LLM Provider',
    'settings.llmDesc': 'Any OpenAI-compatible LLM endpoint',
    'settings.apiKey': 'API Key',
    'settings.baseUrl': 'Base URL',
    'settings.modelName': 'Model Name',
    'settings.language': 'Language',
    'settings.theme': 'Theme',
    'settings.dark': 'Dark',
    'settings.light': 'Light',
    'settings.saved': 'Settings saved',

    // New Podcast Wizard
    'wizard.title': 'New Podcast',
    'wizard.step1': 'Upload Audio',
    'wizard.step1Desc': 'Upload your podcast audio file',
    'wizard.step2': 'Podcast Type',
    'wizard.step2Desc': 'Select the number of speakers',
    'wizard.step3': 'Speaker Detection',
    'wizard.step3Desc': 'Identify and separate speakers',
    'wizard.step4': 'Script Generation',
    'wizard.step4Desc': 'Generate the conversation script',
    'wizard.step5': 'Select AI Host',
    'wizard.step5Desc': 'Choose which speaker becomes the AI host',
    'wizard.step6': 'Voice Cloning',
    'wizard.step6Desc': 'Clone the selected speaker\'s voice',
    'wizard.step7': 'Voice Design',
    'wizard.step7Desc': 'AI analyzes speaking style automatically',
    'wizard.step8': 'Knowledge Base',
    'wizard.step8Desc': 'Build the AI host\'s knowledge',
    'wizard.step9': 'Persona Config',
    'wizard.step9Desc': 'Configure the AI host\'s personality',
    'wizard.upload.drag': 'Drag & drop your audio or video file here',
    'wizard.upload.or': 'or',
    'wizard.upload.browse': 'Browse files',
    'wizard.upload.formats': 'Supports MP3, WAV, M4A, MP4, MOV, AVI, MKV',
    'wizard.type.solo': 'Solo Podcast',
    'wizard.type.multi': 'Multi-Speaker',
    'wizard.type.refCount': 'Reference speaker count (actual count determined by detection)',
    'wizard.detecting': 'Detecting speakers...',
    'wizard.detected': '{count} speakers detected',
    'wizard.generating': 'Generating script...',
    'wizard.cloning': 'Cloning voice...',
    'wizard.analyzing': 'Analyzing speaking style...',
    'wizard.building': 'Building knowledge base...',
    'wizard.pill.upload': 'Upload',
    'wizard.pill.type': 'Format',
    'wizard.pill.speakers': 'Speakers',
    'wizard.pill.script': 'Script',
    'wizard.pill.host': 'Select',
    'wizard.pill.clone': 'Clone',
    'wizard.pill.voice': 'Voice',
    'wizard.pill.knowledge': 'Knowledge',
    'wizard.pill.persona': 'Config',
    'wizard.complete': 'Setup Complete',
    'wizard.completeDesc': 'Your AI host is ready. Start listening, chatting, or get a quick summary.',

    // Listen Mode
    'listen.title': 'Listen',
    'listen.chapters': 'Chapters',
    'listen.transcript': 'Transcript',
    'listen.chatNow': 'Chat Now',
    'listen.speed': 'Speed',

    // Chat Mode
    'chat.title': 'Chat',
    'chat.backToListen': 'Back to Listen',
    'chat.placeholder': 'Type your message...',
    'chat.holdToSpeak': 'Hold to speak',
    'chat.orType': 'or type a message',
    'chat.endChat': 'End Chat',
    'chat.greeting': 'You were just listening to the part about {topic}. What would you like to ask?',

    // Summary Mode
    'summary.title': 'Quick Summary',
    'summary.selectDuration': 'Select summary duration',
    'summary.generate': 'Generate Summary',
    'summary.generating': 'Generating summary...',
    'summary.min': '{n} min',
    'summary.jumpToOriginal': 'Jump to original',
    'summary.emotions.lighthearted': 'Lighthearted',
    'summary.emotions.serious': 'Serious',
    'summary.emotions.excited': 'Excited',
    'summary.emotions.reflective': 'Reflective',
    'summary.emotions.humorous': 'Humorous',

    // Podcast Settings
    'podSettings.title': 'Podcast Settings',
    'podSettings.persona': 'AI Host Persona',
    'podSettings.personality': 'Personality',
    'podSettings.catchphrases': 'Catchphrases',
    'podSettings.answerStyle': 'Answer Style',
    'podSettings.languagePref': 'Language Preference',
    'podSettings.knowledgeBase': 'Knowledge Base',
    'podSettings.scriptChunks': 'Script Chunks',
    'podSettings.crawledPages': 'Crawled Pages',
    'podSettings.previewChat': 'Preview Chat',
    'podSettings.dangerZone': 'Danger Zone',
    'podSettings.deletePodcast': 'Delete Podcast',

    // Storage
    'storage.title': 'Storage',
    'storage.used': 'Used',
    'storage.available': 'Available',
    'storage.exportData': 'Export Data',
    'storage.importData': 'Import Data',
  },
  zh: {
    // Nav & General
    'app.name': 'PodChat',
    'app.tagline': '和你的播客对话',
    'nav.home': '首页',
    'nav.settings': '设置',
    'nav.back': '返回',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.next': '下一步',
    'common.previous': '上一步',
    'common.confirm': '确认',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.export': '导出',
    'common.import': '导入',
    'common.retry': '重试',
    'common.send': '发送',
    'common.close': '关闭',
    'common.loading': '加载中...',
    'common.testConnection': '测试连接',
    'common.connected': '已连接',
    'common.failed': '失败',

    // Home
    'home.title': '我的播客',
    'home.newPodcast': '新建播客',
    'home.empty': '还没有播客',
    'home.emptyDesc': '上传你的第一个播客，开始与 AI 主播对话。',
    'home.duration': '时长',
    'home.created': '创建时间',
    'home.aiHost': 'AI 主播',
    'home.status.ready': '就绪',
    'home.status.configuring': '配置中',
    'home.listen': '收听',
    'home.chat': '开聊',
    'home.summary': '速览',
    'home.continueSetup': '继续配置',

    // Settings
    'settings.title': '设置',
    'settings.subtitle': '配置你的 API 密钥和偏好',
    'settings.elevenlabs': 'ElevenLabs',
    'settings.elevenlabsDesc': '语音识别、声音克隆、TTS 和对话式 AI',
    'settings.firecrawl': 'Firecrawl',
    'settings.firecrawlDesc': '网页内容爬取，用于构建知识库',
    'settings.llm': 'LLM 服务',
    'settings.llmDesc': '兼容 OpenAI 格式的任意 LLM 端点',
    'settings.apiKey': 'API 密钥',
    'settings.baseUrl': '请求地址',
    'settings.modelName': '模型名称',
    'settings.language': '语言',
    'settings.theme': '主题',
    'settings.dark': '深色',
    'settings.light': '浅色',
    'settings.saved': '设置已保存',

    // New Podcast Wizard
    'wizard.title': '新建播客',
    'wizard.step1': '上传音频',
    'wizard.step1Desc': '上传你的播客音频文件',
    'wizard.step2': '播客类型',
    'wizard.step2Desc': '选择说话人数量',
    'wizard.step3': '说话人识别',
    'wizard.step3Desc': '识别并分离说话人',
    'wizard.step4': '脚本生成',
    'wizard.step4Desc': '生成对话脚本',
    'wizard.step5': '选择 AI 主播',
    'wizard.step5Desc': '选择哪位说话人作为 AI 主播',
    'wizard.step6': '声音克隆',
    'wizard.step6Desc': '克隆选定说话人的声音',
    'wizard.step7': '声音设计',
    'wizard.step7Desc': 'AI 自动分析说话风格',
    'wizard.step8': '知识库构建',
    'wizard.step8Desc': '构建 AI 主播的知识库',
    'wizard.step9': '人设配置',
    'wizard.step9Desc': '配置 AI 主播的性格',
    'wizard.upload.drag': '拖放音频或视频文件到这里',
    'wizard.upload.or': '或',
    'wizard.upload.browse': '选择文件',
    'wizard.upload.formats': '支持 MP3、WAV、M4A、MP4、MOV、AVI、MKV',
    'wizard.type.solo': '单人播客',
    'wizard.type.multi': '多人播客',
    'wizard.type.refCount': '参考人数（实际以识别结果为准）',
    'wizard.detecting': '正在识别说话人...',
    'wizard.detected': '识别到 {count} 位说话人',
    'wizard.generating': '正在生成脚本...',
    'wizard.cloning': '正在克隆声音...',
    'wizard.analyzing': '正在分析说话风格...',
    'wizard.building': '正在构建知识库...',
    'wizard.pill.upload': '上传文件',
    'wizard.pill.type': '选择类型',
    'wizard.pill.speakers': '说话人',
    'wizard.pill.script': '脚本',
    'wizard.pill.host': '选择主播',
    'wizard.pill.clone': '克隆',
    'wizard.pill.voice': '声音',
    'wizard.pill.knowledge': '知识库',
    'wizard.pill.persona': '配置人设',
    'wizard.complete': '配置完成',
    'wizard.completeDesc': 'AI 主播已就绪。开始收听、对话或快速浏览。',

    // Listen Mode
    'listen.title': '收听',
    'listen.chapters': '章节',
    'listen.transcript': '文字稿',
    'listen.chatNow': '开聊',
    'listen.speed': '倍速',

    // Chat Mode
    'chat.title': '开聊',
    'chat.backToListen': '返回收听',
    'chat.placeholder': '输入消息...',
    'chat.holdToSpeak': '按住说话',
    'chat.orType': '或输入文字发送',
    'chat.endChat': '结束对话',
    'chat.greeting': '你刚听到我在聊 {topic}，有什么想问的吗？',

    // Summary Mode
    'summary.title': '速览模式',
    'summary.selectDuration': '选择摘要时长',
    'summary.generate': '生成摘要',
    'summary.generating': '正在生成摘要...',
    'summary.min': '{n} 分钟',
    'summary.jumpToOriginal': '跳转原文',
    'summary.emotions.lighthearted': '轻松',
    'summary.emotions.serious': '严肃',
    'summary.emotions.excited': '兴奋',
    'summary.emotions.reflective': '思考',
    'summary.emotions.humorous': '幽默',

    // Podcast Settings
    'podSettings.title': '播客设置',
    'podSettings.persona': 'AI 主播人设',
    'podSettings.personality': '性格特征',
    'podSettings.catchphrases': '口头禅',
    'podSettings.answerStyle': '回答风格',
    'podSettings.languagePref': '语言偏好',
    'podSettings.knowledgeBase': '知识库',
    'podSettings.scriptChunks': '脚本分段',
    'podSettings.crawledPages': '爬取页面',
    'podSettings.previewChat': '预览对话',
    'podSettings.dangerZone': '危险操作',
    'podSettings.deletePodcast': '删除播客',

    // Storage
    'storage.title': '存储',
    'storage.used': '已使用',
    'storage.available': '可用',
    'storage.exportData': '导出数据',
    'storage.importData': '导入数据',
  },
} as const;

type Lang = 'en' | 'zh';
type TranslationKey = string;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      return (localStorage.getItem('podchat_lang') as Lang) || 'en';
    } catch {
      return 'en';
    }
  });

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    try { localStorage.setItem('podchat_lang', newLang); } catch {}
  }, []);

  const t = useCallback((key: TranslationKey, params?: Record<string, string | number>) => {
    let text = translations[lang]?.[key] || translations.en[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
