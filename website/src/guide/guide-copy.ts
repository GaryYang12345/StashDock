import type { Language } from '../copy';

export const pluginCommands = 'codex plugin marketplace add "C:\\StashDock\\plugin"\ncodex plugin add stashdock@personal';

export const guideSections = ['start', 'save', 'manage', 'use', 'ai', 'preferences', 'questions'] as const;
export type GuideSection = typeof guideSections[number];
type Entry = { title: string; body: string };
type GuideCopy = {
  title: string; intro: string; contents: string; back: string;
  sections: Record<GuideSection, string>;
  start: string; choices: Entry[]; quick: Entry[];
  walkthrough: { title: string; body: string; steps: string[]; replay: string; pause: string; resume: string; tools: string; terminal: string; more: string; menu: string; hello: string; placeholder: string; tab: string; search: string; add: string };
  installation: string; platform: string; releases: string; source: string; soon: string;
  desktop: string; plugin: string; extension: string;
  desktopIntro: string; desktopSteps: string[]; desktopMac: string;
  pluginIntro: string; aiInstall: string; aiInstallBody: string; installPrompt: string;
  manualInstall: string; manualBody: string; pluginSteps: string[]; pluginMac: string;
  commands: string; afterInstall: string; pluginNote: string;
  browserIntro: string; browserChoice: string; browserSteps: Record<'chrome' | 'edge' | 'firefox', string[]>;
  browserAfter: string; firefoxNote: string; safariNote: string; browserOs: string;
  copy: string; copied: string; copyFailed: string; copyRecovery: string;
  saveIntro: string; save: Entry[]; manageIntro: string; manage: Entry[];
  useIntro: string; use: Entry[]; aiIntro: string; prompts: Entry[];
  preferencesIntro: string; preferences: Entry[]; questions: Entry[];
};

const en: GuideCopy = {
  title: 'StashDock guide',
  intro: 'Set up StashDock, save your first reference, and bring it into your next AI conversation.',
  contents: 'On this page', back: 'Back to home',
  sections: { start: 'Getting started', save: 'Save references', manage: 'Manage your library', use: 'Use references with AI', ai: 'Work with your AI', preferences: 'Preferences', questions: 'Common questions' },
  start: 'Install the StashDock Desktop app, the AI plugin for ChatGPT, or both. Add the browser extension to save pages as you browse.',
  choices: [
    { title: 'StashDock Desktop', body: 'A standalone library panel. Drag or copy references into conversations in any AI app.' },
    { title: 'AI plugin (ChatGPT)', body: 'Open your library in ChatGPT’s side panel. Select references and choose Add to chat.' },
  ],
  walkthrough: { title: 'Open your library in ChatGPT', body: 'After installing the plugin, open StashDock from the side panel whenever you need your references.', steps: ['Open the side panel', 'Choose More tools', 'Select StashDock', 'Your library opens beside the chat'], replay: 'Replay', pause: 'Pause tutorial', resume: 'Continue tutorial', tools: 'Tools', terminal: 'Terminal', more: 'More tools...', menu: 'Plugins and MCPs', hello: 'What should we work on?', placeholder: 'Ask anything', tab: 'New tab', search: 'Search references', add: 'Add to chat' },
  quick: [
    { title: 'Choose your app', body: 'Install Desktop, the AI plugin or both.' },
    { title: 'Save a reference', body: 'Add a link, file or note. Tags help you find related context later.' },
    { title: 'Bring it to your AI', body: 'Select a reference and use Copy, drag it into your AI app, or choose Add to chat in the plugin.' },
  ],
  installation: 'Install and connect', platform: 'Operating system', releases: 'Open downloads', source: 'Official instructions', soon: 'Coming soon',
  desktop: 'Desktop', plugin: 'ChatGPT plugin', extension: 'Browser extension',
  desktopIntro: 'A standalone library with a floating folder for quick search and reference handoff.',
  desktopSteps: ['Open GitHub Releases and download the Windows x64 Desktop installer ending in -setup.exe.', 'Run the installer, then launch StashDock Desktop. It sets up the required WebView2 runtime.', 'Choose Import references to add your first item. The floating folder is enabled by default.'],
  desktopMac: 'The macOS Desktop package is coming soon. Its installation steps will be added with the release.',
  pluginIntro: 'Browse and manage your library beside a local ChatGPT conversation. StashDock Desktop is optional.',
  aiInstall: 'Set up with your AI',
  aiInstallBody: 'Paste this request into a local ChatGPT desktop conversation with access to files and terminal tools. The AI can help register the marketplace and install the matching package.',
  installPrompt: 'Help me install StashDock from https://github.com/GaryYang12345/StashDock/releases/latest on this computer. Check my operating system and architecture. Use the complete matching plugin release ZIP, including its runtime and native helpers. Extract it to a permanent folder and follow the package installation guide. Use supported local plugin marketplace commands if available, preserving my other plugins and settings. Verify that StashDock is installed and enabled. If a matching package or required command is unavailable, explain the next step. Tell me whether I need to restart ChatGPT or start a new conversation.',
  manualInstall: 'Set up manually', manualBody: 'Use the complete plugin ZIP from Releases. GitHub’s automatic Source code archives do not include the runtime and native helpers.',
  pluginSteps: ['Download the plugin ZIP whose name ends in win32-x64.zip.', 'Extract the entire archive to a permanent folder. Keep the hidden .agents folder and plugins folder together.', 'With Codex CLI available, run the commands below. Replace the example path with the extracted folder containing .agents and plugins.'],
  commands: 'Local marketplace commands', afterInstall: 'Restart ChatGPT if the plugin does not appear, then start a new local conversation. Follow the tutorial below to open your library, or ask “Open my StashDock.”',
  pluginNote: 'The local plugin includes its own runtime. You do not need to install Node.js or npm. It is distributed through a local marketplace, separate from the public Plugins Directory.',
  pluginMac: 'The macOS plugin package is coming soon. Choose the published package for your Mac’s architecture when it becomes available; the Windows ZIP contains Windows-only helpers.',
  browserIntro: 'Save the page you are reading into your local library. Keep Desktop or the AI plugin running on this computer while you save.',
  browserChoice: 'Browser',
  browserSteps: {
    chrome: ['Download the Chrome extension ZIP from Releases and extract it to a permanent folder.', 'Open chrome://extensions in the address bar and turn on Developer mode.', 'Choose Load unpacked, then select the extracted folder containing manifest.json.', 'Pin StashDock from the Extensions menu. Open a webpage and click its toolbar icon.'],
    edge: ['Download the Edge extension ZIP from Releases and extract it to a permanent folder.', 'Open edge://extensions in the address bar and turn on Developer mode.', 'Choose Load unpacked, then select the extracted folder containing manifest.json.', 'Show StashDock in the toolbar. Open a webpage and click its icon.'],
    firefox: ['Download the Firefox extension ZIP from Releases and extract it.', 'Open about:debugging#/runtime/this-firefox in the address bar.', 'Choose Load Temporary Add-on, then select manifest.json inside the extracted folder.', 'Open a webpage and click StashDock from the Extensions menu or toolbar.'],
  },
  browserAfter: 'Allow access to the page when the browser asks. Review the title and content, choose tags, then click Save page. Saving keeps the sidebar open.',
  firefoxNote: 'This Firefox package is a temporary installation and is removed when Firefox closes. A signed package is needed for permanent installation.',
  safariNote: 'Safari needs its own macOS extension package. StashDock for Safari is coming soon.',
  browserOs: 'Chrome, Edge and Firefox use the same installation steps on Windows and macOS. Saving on Mac also needs a released macOS Desktop or AI plugin package.',
  copy: 'Copy', copied: 'Copied', copyFailed: 'Could not copy', copyRecovery: 'Select the text and copy it manually.',
  saveIntro: 'References can hold sources, examples, files, prompts or rules. Keep the pieces you want to reuse.',
  save: [
    { title: 'A page you are reading', body: 'Click the browser extension, review its captured title and content, add tags, then choose Save page. Expand long posts before saving.' },
    { title: 'A link', body: 'Open Import references, choose Link and paste the URL. Review the information, add tags and save.' },
    { title: 'Browser bookmarks', body: 'In Import references, choose a browser, select the bookmarks to keep and start the import. References receive the browser’s tag; covers can continue loading afterward.' },
    { title: 'A local file', body: 'Choose File, select the original file and review its title and tags before saving. You can open the file from its card later.' },
    { title: 'A note, prompt or rule', body: 'Choose Note and write reusable instructions, project background or an example you want your AI to follow. Add a clear title and save.' },
  ],
  manageIntro: 'Use a few meaningful tags to make context easy to find and combine.',
  manage: [
    { title: 'Find and group', body: 'Search your library, filter Web or Files, or choose a tag. Favorite frequently used references. One reference can have several tags.' },
    { title: 'Edit a card', body: 'Open its three-dot menu and choose Edit card to change the title, tags or cover.' },
    { title: 'Edit the context', body: 'Choose Edit content to review what you hand to AI. Switch between Content and Preview, then save your changes.' },
    { title: 'Open or remove', body: 'The source arrow opens a webpage or original file. Select several cards to use them together or delete them in one action.' },
  ],
  useIntro: 'Give your AI both the references and a clear task: what to use them for, and what you want back.',
  use: [
    { title: 'From Desktop', body: 'Copy a card and paste it into your AI app, or drag it into the conversation. Select several cards to hand them off together.' },
    { title: 'From the floating folder', body: 'Hover the folder to search. Drag a matching reference into your AI app, use Copy, or click the folder to open your library.' },
    { title: 'From the ChatGPT plugin', body: 'Open the side panel, choose More tools, then StashDock. Select references and choose Add to chat, then send your question or task. You can also ask “Open my StashDock.”' },
    { title: 'With files and sources', body: 'File references point to the original file; webpages retain their source URL. Ask the AI to read the attached file or linked source when your task needs details beyond the saved context.' },
  ],
  aiIntro: 'The ChatGPT plugin combines your library with the AI’s ability to find, organize and create context. Try these requests in a local conversation with StashDock enabled.',
  prompts: [
    { title: 'Find references for a task', body: 'Look through my StashDock for references that would help with this project. Recommend the most relevant ones and explain how to use each.' },
    { title: 'Use a tag as a context group', body: 'Use my StashDock references tagged Design to review this interface. Read the relevant sources before suggesting changes.' },
    { title: 'Organize tags', body: 'Review the tags in my StashDock and propose a clearer organization. Show the exact changes for my approval before applying them.' },
    { title: 'Save a useful outcome', body: 'Turn the writing rules we agreed on into a reusable note and save it to StashDock with the Writing tag.' },
  ],
  preferencesIntro: 'Open Settings from the library panel.',
  preferences: [
    { title: 'Language and appearance', body: 'Choose your interface language and use the system, light or dark theme.' },
    { title: 'Floating folder', body: 'In Desktop, turn Floating window off for a normal application window. Turn it on to keep the quick-access folder.' },
    { title: 'Storage location', body: 'View or change the local library location. Desktop and the AI plugin on this computer share it. Libraries on different computers do not sync automatically.' },
    { title: 'Updates', body: 'Get new packages from Releases. Update Desktop with its installer. For the plugin, follow the release’s installation steps. For unpacked Chrome or Edge extensions, replace the files in the same folder, choose Reload on the extensions page, then refresh the webpage.' },
  ],
  questions: [
    { title: 'The browser extension cannot connect. What should I do?', body: 'Open the latest StashDock Desktop or its AI plugin on this computer, then choose Check again in the sidebar. If the browser asks for local-network or page access, allow the access needed to save.' },
    { title: 'Why is some page content missing?', body: 'Wait for the page to load and expand collapsed posts before capturing again. StashDock saves readable, loaded text. The reference still keeps its URL so your AI can open the source.' },
    { title: 'Do I need all three parts?', body: 'Choose Desktop, the AI plugin or both. The browser extension adds convenient page saving and needs one of those local entry points running.' },
    { title: 'Can I install the plugin by pasting a GitHub URL?', body: 'Use the install request above in a local chat with file and terminal tools. Git-backed marketplaces are supported, but StashDock also needs its matching runtime package. Use the complete release archive for the current installation.' },
    { title: 'What is different on Mac?', body: 'Desktop and AI plugins need packages built for macOS and the correct architecture. Chrome, Edge and Firefox follow the same browser steps. Safari uses a separate Mac extension. Check Releases for available packages.' },
  ],
};

const zh: GuideCopy = {
  title: '使用指南',
  intro: '安装 StashDock，保存第一条参考，把它用于下一次 AI 对话。', contents: '本页目录', back: '返回首页',
  sections: { start: '开始使用', save: '收藏参考', manage: '管理收藏库', use: '将参考用于 AI', ai: '让 AI 帮你处理收藏', preferences: '偏好设置', questions: '常见问题' },
  start: 'StashDock Desktop 桌面应用与 AI 插件（ChatGPT）可以任选其一，也可以同时安装。安装浏览器扩展，还能随手保存正在浏览的网页。',
  choices: [
    { title: 'StashDock Desktop', body: '独立的收藏库面板，通过拖拽或复制，将参考交给任意 AI 应用中的对话。' },
    { title: 'AI 插件（ChatGPT）', body: '在 ChatGPT 侧边面板中打开收藏库，选择参考，点击「添加到对话」即可使用。' },
  ],
  walkthrough: { title: '在 ChatGPT 中打开收藏库', body: '安装插件后，随时从侧边面板打开 StashDock，使用你的参考。', steps: ['打开侧边面板', '展开 More tools', '选择 StashDock', '收藏库出现在对话旁'], replay: '重播', pause: '暂停教程', resume: '继续教程', tools: 'Tools', terminal: 'Terminal', more: 'More tools...', menu: 'Plugins and MCPs', hello: '我们来做些什么？', placeholder: '向 AI 提问', tab: 'New tab', search: '搜索参考', add: '添加到对话' },
  quick: [
    { title: '选择应用', body: '安装 Desktop、AI 插件，或同时安装。' },
    { title: '保存一条参考', body: '添加链接、文件或笔记，用标签归类，方便以后查找。' },
    { title: '交给你的 AI', body: '复制参考、拖入 AI 应用，或在插件面板中点击「添加到对话」。' },
  ],
  installation: '安装与连接', platform: '操作系统', releases: '打开下载页', source: '官方安装说明', soon: '即将推出',
  desktop: '桌面应用', plugin: 'ChatGPT 插件', extension: '浏览器扩展',
  desktopIntro: '独立的可视化收藏库，配合悬浮文件夹快速搜索和使用参考。',
  desktopSteps: ['打开 GitHub Releases，下载名称以 -setup.exe 结尾的 Windows x64 桌面安装包。', '运行安装程序，再打开 StashDock Desktop。安装程序会处理所需的 WebView2 运行时。', '点击「导入参考」添加第一条收藏。悬浮文件夹默认开启。'],
  desktopMac: 'macOS 桌面安装包即将推出，对应步骤将随版本发布补充。',
  pluginIntro: '在本机 ChatGPT 对话旁浏览、管理和使用参考，无需另装 StashDock Desktop。',
  aiInstall: '让 AI 协助安装', aiInstallBody: '将下面的请求发到支持本机文件和终端工具的 ChatGPT 桌面对话。AI 可以协助注册插件市场并安装适合当前系统的包。',
  installPrompt: '请帮我在这台电脑上安装 StashDock：https://github.com/GaryYang12345/StashDock/releases/latest。先检查操作系统和处理器架构，选择匹配的完整插件 Release ZIP，包含运行时和原生辅助程序。解压到固定目录，并按包内安装指南操作。如果支持本地插件市场命令，使用官方支持的命令注册和安装，保留我已有的其他插件及设置。验证 StashDock 已安装并启用。如果缺少匹配安装包或必要命令，说明下一步。完成后告诉我是否需要重启 ChatGPT 或开启新对话。',
  manualInstall: '手动安装', manualBody: '下载 Releases 中的完整插件 ZIP。GitHub 自动生成的 Source code 压缩包不含所需运行时和原生辅助程序。',
  pluginSteps: ['下载名称以 win32-x64.zip 结尾的插件 ZIP。', '完整解压到固定目录，保留隐藏的 .agents 文件夹，并让它与 plugins 文件夹处于同一层。', '已安装 Codex CLI 时，运行下方命令。将示例路径替换为解压后包含 .agents 和 plugins 的目录。'],
  commands: '本地插件市场命令', afterInstall: '如果未显示插件，重启 ChatGPT，再开启本机新对话。按照下方教程打开收藏库，也可以输入「打开我的 StashDock」。',
  pluginNote: '插件自带运行时，无需单独安装 Node.js 或 npm。当前通过本地插件市场分发，与公开插件目录分开。',
  pluginMac: 'macOS 插件包即将推出。发布后请按 Mac 的处理器架构选择对应包；Windows ZIP 内的辅助程序只能在 Windows 运行。',
  browserIntro: '将正在浏览的网页保存到本地收藏库。保存时，请在这台电脑上运行 Desktop 或 AI 插件。', browserChoice: '浏览器',
  browserSteps: {
    chrome: ['从 Releases 下载 Chrome 扩展 ZIP，并解压到固定目录。', '在地址栏打开 chrome://extensions，开启「开发者模式」。', '点击「加载已解压的扩展程序」，选择包含 manifest.json 的解压目录。', '在扩展菜单中固定 StashDock，打开网页后点击工具栏图标。'],
    edge: ['从 Releases 下载 Edge 扩展 ZIP，并解压到固定目录。', '在地址栏打开 edge://extensions，开启「开发人员模式」。', '点击「加载解压缩的扩展」，选择包含 manifest.json 的解压目录。', '让 StashDock 显示在工具栏，打开网页后点击图标。'],
    firefox: ['从 Releases 下载 Firefox 扩展 ZIP，并解压。', '在地址栏打开 about:debugging#/runtime/this-firefox。', '点击「临时载入附加组件」，选择解压目录中的 manifest.json。', '打开网页，从扩展菜单或工具栏点击 StashDock。'],
  },
  browserAfter: '按浏览器提示授权当前网页访问，检查标题和正文，选择标签后点击「保存网页」。保存后侧栏会保持打开。',
  firefoxNote: '当前 Firefox 包采用临时安装，关闭 Firefox 后会移除。永久安装需要后续发布的签名包。',
  safariNote: 'Safari 需要单独的 macOS 扩展包，StashDock Safari 扩展即将推出。',
  browserOs: 'Chrome、Edge、Firefox 在 Windows 和 macOS 上的安装步骤相同。在 Mac 上保存网页，还需要已发布的 macOS Desktop 或 AI 插件。',
  copy: '复制', copied: '已复制', copyFailed: '复制失败', copyRecovery: '请选中文字后手动复制。',
  saveIntro: '参考可以是资料、示例、文件、提示词或规则。保存以后希望反复使用的内容。',
  save: [
    { title: '正在浏览的网页', body: '点击浏览器扩展，检查读取到的标题和正文，选择标签，再点击「保存网页」。长帖请先展开。' },
    { title: '一个链接', body: '打开「导入参考」，选择链接并粘贴网址，检查信息、选择标签后保存。' },
    { title: '浏览器书签', body: '在「导入参考」中选择浏览器，勾选要保留的书签并开始导入。参考会带上浏览器标签，封面可以在导入后继续加载。' },
    { title: '本地文件', body: '选择文件，选中原始文件，检查标题和标签后保存。以后可从卡片直接打开文件。' },
    { title: '笔记、提示词或规则', body: '选择笔记，写下希望复用的指令、项目背景或示例，添加清晰的标题后保存。' },
  ],
  manageIntro: '使用少量有意义的标签，让上下文方便查找和组合。',
  manage: [
    { title: '查找与归类', body: '搜索收藏库，筛选网页、文件或某个标签。将常用参考加入收藏夹；一条参考可以有多个标签。' },
    { title: '编辑卡片', body: '点击卡片的三点菜单，选择「编辑卡片」，修改标题、标签或封面。' },
    { title: '编辑上下文', body: '选择「编辑内容」，检查交给 AI 的上下文。在「内容」与「预览」之间切换，修改后保存。' },
    { title: '打开与删除', body: '来源旁的箭头可打开网页或原始文件。选择多张卡片，可以一起使用或批量删除。' },
  ],
  useIntro: '将参考和明确的任务一起交给 AI：希望如何使用这些资料，以及需要什么结果。',
  use: [
    { title: '通过 Desktop', body: '复制卡片后粘贴到 AI 应用，或直接将卡片拖入对话。选中多张卡片可以一起交给 AI。' },
    { title: '通过悬浮文件夹', body: '将鼠标移到文件夹上搜索，再拖动结果到 AI 应用或点击复制。点击文件夹可打开完整收藏库。' },
    { title: '通过 ChatGPT 插件', body: '打开侧边面板，展开 More tools，选择 StashDock。在面板中选择参考，点击「添加到对话」，再发送问题或任务。也可以输入「打开我的 StashDock」。' },
    { title: '使用文件与原始来源', body: '文件参考保留原始文件，网页参考保留来源网址。如果任务需要已保存上下文以外的细节，请让 AI 读取附件或对应链接。' },
  ],
  aiIntro: 'ChatGPT 插件让 AI 帮你查找、整理和创建上下文。启用 StashDock 后，可以在本机对话中试试下面的请求。',
  prompts: [
    { title: '为任务寻找参考', body: '请查看我的 StashDock，推荐适合当前项目的参考，并说明每条参考可以用在哪里。' },
    { title: '按标签组合上下文', body: '使用我的 StashDock 中带 Design 标签的参考审查这个界面，先读取相关来源，再提出修改建议。' },
    { title: '整理标签', body: '检查我的 StashDock 标签，提出更清晰的整理方案。先展示每条参考具体要怎样改，等我确认后再应用。' },
    { title: '保存有用的对话成果', body: '将我们刚刚确定的写作规则整理成可复用的笔记，保存到 StashDock，并加上 Writing 标签。' },
  ],
  preferencesIntro: '从收藏库面板打开设置。',
  preferences: [
    { title: '语言与主题', body: '选择界面语言，使用系统、浅色或深色主题。' },
    { title: '悬浮文件夹', body: '在 Desktop 中关闭「悬浮窗」后，以普通应用窗口使用；开启后恢复快速访问文件夹。' },
    { title: '存储位置', body: '查看或更改本地收藏库的位置。同一台电脑上的 Desktop 与 AI 插件共用它；不同电脑之间不会自动同步。' },
    { title: '更新版本', body: '从 Releases 获取新版。Desktop 运行新版安装程序；插件按照对应版本的安装步骤更新。已解压安装的 Chrome、Edge 扩展请在原目录替换文件，在扩展管理页点击重新加载，再刷新网页。' },
  ],
  questions: [
    { title: '浏览器扩展连接失败怎么办？', body: '在这台电脑打开最新版 StashDock Desktop 或 AI 插件，再点击侧栏中的「重新检查」。如浏览器询问本地网络或网页访问权限，请允许保存所需的访问。' },
    { title: '为什么网页正文不完整？', body: '等网页加载完成，展开折叠的长帖后再读取。StashDock 保存已加载的可读内容，同时保留来源网址，方便 AI 继续查看。' },
    { title: '三个部分都要装吗？', body: 'Desktop、AI 插件可任选一个，也可以都装。浏览器扩展负责快捷保存网页，需要其中一个本机入口运行。' },
    { title: '给 AI 一个 GitHub 链接就能装插件吗？', body: '请在支持本机文件和终端工具的对话中使用上方安装请求。宿主支持 GitHub 插件市场，但 StashDock 还需要匹配系统的运行时，当前应使用 Releases 中的完整插件包。' },
    { title: 'Mac 与 Windows 有什么不同？', body: 'Desktop 和 AI 插件需要对应操作系统及架构的包。Chrome、Edge、Firefox 的浏览器安装步骤相同，Safari 使用独立的 Mac 扩展。可用安装包以 Releases 为准。' },
  ],
};

export const guideCopy: Record<Language, GuideCopy> = { en, zh };
