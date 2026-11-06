'use client'

import {
  Activity,
  ArrowDownToLine,
  ArrowUpRight,
  AudioLines,
  Check,
  ChevronDown,
  CircleHelp,
  Clapperboard,
  CloudUpload,
  Cpu,
  Film,
  FolderOpen,
  Layers3,
  LoaderCircle,
  Plus,
  Radio,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'

type Avatar = {
  id: string
  name: string
  videoPath: string
  createdAt: number
}

type Task = {
  id: string
  name: string
  avatarId: string
  text: string
  status: string
  message: string | null
  progress: number
  outputPath: string | null
  createdAt: number
}

type Health = {
  tts: { online: boolean }
  video: { online: boolean }
}

type ViewName = 'studio' | 'library' | 'tasks'
type CreationStep = 1 | 2 | 3

const navigation: { id: ViewName; label: string; icon: typeof Clapperboard }[] = [
  { id: 'studio', label: '创作工作台', icon: Sparkles },
  { id: 'library', label: '数字人', icon: UsersRound },
  { id: 'tasks', label: '合成记录', icon: Layers3 },
]

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function statusLabel(status: string) {
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  return '合成中'
}

export default function Studio() {
  const [view, setView] = useState<ViewName>('studio')
  const [creationStep, setCreationStep] = useState<CreationStep>(1)
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [health, setHealth] = useState<Health | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [text, setText] = useState('')
  const [taskName, setTaskName] = useState('')
  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [busy, setBusy] = useState<'upload' | 'synthesis' | null>(null)
  const [notice, setNotice] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [modelResponse, taskResponse, healthResponse] = await Promise.all([
        fetch('/api/models', { cache: 'no-store' }),
        fetch('/api/tasks', { cache: 'no-store' }),
        fetch('/api/health', { cache: 'no-store' }),
      ])
      if (modelResponse.ok) {
        const result = (await modelResponse.json()) as { list: Avatar[] }
        setAvatars(result.list)
        setSelectedId((current) => current || result.list[0]?.id || '')
      }
      if (taskResponse.ok) {
        const result = (await taskResponse.json()) as { list: Task[] }
        setTasks(result.list)
      }
      if (healthResponse.ok) setHealth((await healthResponse.json()) as Health)
    } catch {
      setNotice('无法连接 Web 服务，请确认服务正在运行。')
    }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const selectedAvatar = avatars.find((avatar) => avatar.id === selectedId)
  const pendingCount = tasks.filter((task) => task.status === 'processing').length

  function openCreationStep(step: CreationStep) {
    if (step >= 2 && !selectedId) {
      setNotice('先选择一个数字人，或上传视频创建数字人。')
      return
    }
    if (step === 3 && !text.trim()) {
      setNotice('先填写要说的文案。')
      return
    }
    setNotice('')
    setCreationStep(step)
  }

  async function submitModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!uploadFile || !uploadName.trim()) {
      setNotice('请填写名称并选择一个视频文件。')
      return
    }

    setBusy('upload')
    setNotice('正在上传、转码并训练声音模型…')
    const body = new FormData()
    body.set('name', uploadName.trim())
    body.set('video', uploadFile)
    try {
      const response = await fetch('/api/models', { method: 'POST', body })
      const result = (await response.json()) as { avatar?: Avatar; error?: string }
      if (!response.ok || !result.avatar) throw new Error(result.error || '数字人创建失败')
      setUploadOpen(false)
      setUploadName('')
      setUploadFile(null)
      setSelectedId(result.avatar.id)
      setCreationStep(2)
      setNotice('数字人已添加，可以开始合成。')
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '数字人创建失败')
    } finally {
      setBusy(null)
    }
  }

  async function submitSynthesis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedId || !text.trim()) {
      setNotice('请选择数字人并填写合成文本。')
      return
    }

    setBusy('synthesis')
    setNotice('正在生成语音并提交视频合成…')
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ avatarId: selectedId, name: taskName.trim(), text: text.trim() }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(result.error || '任务提交失败')
      setText('')
      setTaskName('')
      setNotice('任务已提交，合成进度会自动更新。')
      setView('tasks')
      await refresh()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '任务提交失败')
    } finally {
      setBusy(null)
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" type="button" onClick={() => setView('studio')}>
          <span className="brand-mark">
            <span />
          </span>
          <span>
            <strong>duix</strong>
            <small>AVATAR STUDIO</small>
          </span>
        </button>
        <div className="workspace-label">工作空间</div>
        <nav className="navigation" aria-label="主导航">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={view === id ? 'nav-item active' : 'nav-item'}
              onClick={() => setView(id)}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {id === 'tasks' && pendingCount > 0 && (
                <span className="nav-count">{pendingCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <section className="service-card" aria-label="服务状态">
          <div className="service-card-top">
            <Radio size={15} />
            <span>本机推理服务</span>
            <span className="live-dot" />
          </div>
          <div className="service-line">
            <span>TTS 语音</span>
            <b className={health?.tts.online ? 'online' : 'offline'}>
              {health?.tts.online ? '在线' : '离线'}
            </b>
          </div>
          <div className="service-line">
            <span>视频生成</span>
            <b className={health?.video.online ? 'online' : 'offline'}>
              {health?.video.online ? '在线' : '离线'}
            </b>
          </div>
        </section>
        <div className="sidebar-footer">
          <CircleHelp size={15} /> <span>Duix Avatar Web</span>
          <span className="version">1.0</span>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>DUiX /</span>
            <strong>{navigation.find((item) => item.id === view)?.label}</strong>
          </div>
          <div className="topbar-meta">
            <span className="local-chip">
              <Cpu size={14} /> LOCAL GPU
            </span>
            <span className="topbar-divider" />
            <span className="avatar-count">{avatars.length} 个数字人</span>
          </div>
        </header>

        <div className="content-wrap">
          {view === 'studio' && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    CREATION DESK <span>01</span>
                  </p>
                  <h1>三步，完成一条数字人视频。</h1>
                  <p className="heading-subtitle">先选形象，再写文案，最后生成视频。</p>
                </div>
                <div className="heading-mark">
                  <AudioLines size={22} />
                  <span>
                    STUDIO
                    <br />
                    SESSION
                  </span>
                  <ArrowUpRight size={16} />
                </div>
              </div>

              <nav className="workflow-progress" aria-label="视频创作步骤">
                {(
                  [
                    { id: 1, title: '选择数字人', detail: '选择已有形象或添加视频' },
                    { id: 2, title: '编写文案', detail: '输入数字人要说的话' },
                    { id: 3, title: '确认生成', detail: '检查内容并开始合成' },
                  ] as const
                ).map((step) => (
                  <button
                    className={
                      creationStep === step.id
                        ? 'workflow-step active'
                        : creationStep > step.id
                          ? 'workflow-step complete'
                          : 'workflow-step'
                    }
                    key={step.id}
                    type="button"
                    aria-current={creationStep === step.id ? 'step' : undefined}
                    onClick={() => openCreationStep(step.id)}
                  >
                    <span className="workflow-marker">
                      {creationStep > step.id ? <Check size={14} /> : `0${step.id}`}
                    </span>
                    <span className="workflow-step-copy">
                      <strong>{step.title}</strong>
                      <small>{step.detail}</small>
                    </span>
                  </button>
                ))}
              </nav>

              <div className="studio-grid guided-layout">
                <section className="synthesis-panel">
                  <div className="section-heading">
                    <div>
                      <span className="step-number">01</span>
                      <h2>新建视频</h2>
                    </div>
                    <span className="duration-note">
                      <Activity size={14} /> GPU 合成
                    </span>
                  </div>
                  <form
                    className="synthesis-form"
                    onSubmit={(event) => {
                      if (creationStep === 3) void submitSynthesis(event)
                      else event.preventDefault()
                    }}
                  >
                    {creationStep === 1 && (
                      <div className="wizard-pane">
                        <p className="wizard-intro">
                          选择一个已训练的数字人，或先从视频创建新形象。
                        </p>
                        <label className="field-label" htmlFor="avatar-select">
                          当前形象
                        </label>
                        <div className="select-wrap">
                          <select
                            id="avatar-select"
                            value={selectedId}
                            onChange={(event) => setSelectedId(event.target.value)}
                            disabled={!avatars.length}
                          >
                            {!avatars.length && <option value="">还没有数字人</option>}
                            {avatars.map((avatar) => (
                              <option value={avatar.id} key={avatar.id}>
                                {avatar.name}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={16} />
                        </div>
                        {selectedAvatar ? (
                          <div className="selected-avatar">
                            <video
                              src={`/api/media?modelId=${selectedAvatar.id}`}
                              muted
                              playsInline
                              preload="metadata"
                            />
                            <span>
                              <b>{selectedAvatar.name}</b>
                              <small>声音模型已就绪</small>
                            </span>
                            <Check size={16} />
                          </div>
                        ) : (
                          <button
                            className="empty-model"
                            type="button"
                            onClick={() => setUploadOpen(true)}
                          >
                            <Plus size={18} />
                            <span>上传一个视频，创建数字人</span>
                            <ArrowUpRight size={15} />
                          </button>
                        )}
                        <div className="workflow-guidance">
                          <Film size={17} />
                          <span>
                            <strong>数字人需要什么素材？</strong>
                            <small>
                              一个有人物画面且带清晰人声的视频即可。系统会从视频提取画面并训练声音，不需要单独上传音频或图片。
                            </small>
                          </span>
                        </div>
                        <div className="workflow-actions">
                          <span>第 1 步，共 3 步</span>
                          <button
                            className="primary-button"
                            type="button"
                            disabled={!selectedAvatar}
                            onClick={() => openCreationStep(2)}
                          >
                            下一步：写文案 <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </div>
                    )}

                    {creationStep === 2 && (
                      <div className="wizard-pane">
                        <div className="step-context">
                          <span>本次使用</span>
                          <strong>{selectedAvatar?.name}</strong>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => openCreationStep(1)}
                          >
                            更换形象
                          </button>
                        </div>
                        <label className="field-label" htmlFor="task-title">
                          作品名称 <span>可选</span>
                        </label>
                        <input
                          id="task-title"
                          className="text-input"
                          value={taskName}
                          onChange={(event) => setTaskName(event.target.value)}
                          placeholder="例如：新品介绍"
                          maxLength={80}
                        />
                        <div className="script-label">
                          <label className="field-label" htmlFor="script">
                            数字人要说的话
                          </label>
                          <span>{text.length} / 5000</span>
                        </div>
                        <textarea
                          id="script"
                          value={text}
                          onChange={(event) => setText(event.target.value)}
                          placeholder="输入完整文案，系统会用该数字人的声音朗读…"
                          maxLength={5000}
                          rows={7}
                        />
                        <div className="workflow-guidance compact-guidance">
                          <AudioLines size={17} />
                          <span>
                            <strong>声音会自动生成</strong>
                            <small>使用创建数字人时从视频训练出的声音，无需再上传配音文件。</small>
                          </span>
                        </div>
                        <div className="workflow-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => openCreationStep(1)}
                          >
                            上一步
                          </button>
                          <button
                            className="primary-button"
                            type="button"
                            disabled={!text.trim()}
                            onClick={() => openCreationStep(3)}
                          >
                            下一步：确认内容 <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </div>
                    )}

                    {creationStep === 3 && (
                      <div className="wizard-pane">
                        <p className="wizard-intro">
                          确认形象和文案后，系统会先生成语音，再提交视频合成。
                        </p>
                        <div className="review-avatar">
                          {selectedAvatar && (
                            <video
                              src={`/api/media?modelId=${selectedAvatar.id}`}
                              muted
                              playsInline
                              preload="metadata"
                            />
                          )}
                          <span>
                            <small>数字人</small>
                            <strong>{selectedAvatar?.name}</strong>
                          </span>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => openCreationStep(1)}
                          >
                            更换
                          </button>
                        </div>
                        <div className="review-title">
                          <span>作品名称</span>
                          <strong>{taskName.trim() || '未命名作品'}</strong>
                        </div>
                        <div className="review-script">
                          <div>
                            <span>合成文案</span>
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => openCreationStep(2)}
                            >
                              编辑
                            </button>
                          </div>
                          <p>{text}</p>
                        </div>
                        <div className="workflow-guidance compact-guidance">
                          <Clapperboard size={17} />
                          <span>
                            <strong>准备就绪</strong>
                            <small>提交后可在“合成记录”中查看进度，完成后下载视频。</small>
                          </span>
                        </div>
                        <div className="workflow-actions">
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => openCreationStep(2)}
                          >
                            上一步
                          </button>
                          <button className="primary-button" type="submit" disabled={busy !== null}>
                            {busy === 'synthesis' ? (
                              <LoaderCircle className="spin" size={17} />
                            ) : (
                              <Sparkles size={17} />
                            )}
                            {busy === 'synthesis' ? '提交中' : '确认并生成视频'}
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                </section>

                <aside className="library-panel">
                  <div className="section-heading">
                    <div>
                      <span className="step-number">02</span>
                      <h2>数字人库</h2>
                    </div>
                    <button
                      className="icon-button"
                      type="button"
                      title="添加数字人"
                      onClick={() => setUploadOpen(true)}
                    >
                      <Plus size={18} />
                    </button>
                  </div>
                  <div className="library-summary">
                    <span>已就绪的形象</span>
                    <strong>
                      {String(avatars.length).padStart(2, '0')}
                      <small> 个</small>
                    </strong>
                  </div>
                  <div className="avatar-list">
                    {avatars.slice(0, 4).map((avatar, index) => (
                      <button
                        key={avatar.id}
                        type="button"
                        className={selectedId === avatar.id ? 'avatar-row selected' : 'avatar-row'}
                        onClick={() => setSelectedId(avatar.id)}
                      >
                        <span className={`avatar-index tone-${index % 4}`}>
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="avatar-row-copy">
                          <b>{avatar.name}</b>
                          <small>添加于 {formatTime(avatar.createdAt)}</small>
                        </span>
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                    {!avatars.length && (
                      <div className="empty-library">
                        <FolderOpen size={23} />
                        <span>这里还没有数字人</span>
                        <small>上传一段视频来创建你的第一个形象</small>
                      </div>
                    )}
                  </div>
                  <button className="text-button" type="button" onClick={() => setView('library')}>
                    查看全部形象 <ArrowUpRight size={14} />
                  </button>
                  <div className="library-footnote">
                    <Film size={15} />
                    <span>视频文件保存在服务端工作目录，可通过配置更改。</span>
                  </div>
                </aside>
              </div>

              <section className="recent-section">
                <div className="recent-heading">
                  <div>
                    <p className="eyebrow">
                      ACTIVITY <span>02</span>
                    </p>
                    <h2>最近合成</h2>
                  </div>
                  <button className="text-button" type="button" onClick={() => setView('tasks')}>
                    全部记录 <ArrowUpRight size={14} />
                  </button>
                </div>
                <TaskList tasks={tasks.slice(0, 3)} />
              </section>
            </>
          )}

          {view === 'library' && (
            <>
              <div className="page-heading compact-heading">
                <div>
                  <p className="eyebrow">
                    YOUR CAST <span>02</span>
                  </p>
                  <h1>数字人库</h1>
                  <p className="heading-subtitle">每个形象都包含独立的声音模型。</p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => setUploadOpen(true)}
                >
                  <Plus size={17} />
                  添加数字人
                </button>
              </div>
              <div className="avatar-grid">
                {avatars.map((avatar, index) => (
                  <article key={avatar.id} className="avatar-card">
                    <div className="avatar-card-video">
                      <video
                        src={`/api/media?modelId=${avatar.id}`}
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <span className={`avatar-index tone-${index % 4}`}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="avatar-card-info">
                      <div>
                        <h2>{avatar.name}</h2>
                        <p>声音模型已就绪 · {formatTime(avatar.createdAt)}</p>
                      </div>
                      <button
                        className="icon-button"
                        type="button"
                        title="用于新建视频"
                        onClick={() => {
                          setSelectedId(avatar.id)
                          setView('studio')
                        }}
                      >
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                  </article>
                ))}
                {!avatars.length && (
                  <div className="empty-state">
                    <UsersRound size={28} />
                    <h2>数字人库还是空的</h2>
                    <p>上传一段视频，服务端会自动提取画面和训练声音。</p>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => setUploadOpen(true)}
                    >
                      <Plus size={17} />
                      添加数字人
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {view === 'tasks' && (
            <>
              <div className="page-heading compact-heading">
                <div>
                  <p className="eyebrow">
                    RENDER QUEUE <span>03</span>
                  </p>
                  <h1>合成记录</h1>
                  <p className="heading-subtitle">任务状态每 5 秒自动刷新。</p>
                </div>
                <span className="queue-count">
                  <Activity size={16} />
                  {pendingCount} 个进行中
                </span>
              </div>
              <TaskList tasks={tasks} expanded />
            </>
          )}

          {notice && (
            <div className="notice" role="status">
              <span>{notice}</span>
              <button type="button" title="关闭提示" onClick={() => setNotice('')}>
                <X size={15} />
              </button>
            </div>
          )}
          <footer className="content-footer">
            <span>
              Duix Avatar <b>WEB STUDIO</b>
            </span>
            <span>文件由此服务所在主机处理</span>
          </footer>
        </div>
      </section>

      {uploadOpen && (
        <div className="dialog-backdrop" role="presentation">
          <section
            className="upload-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="upload-title"
          >
            <header>
              <div>
                <p className="eyebrow">NEW AVATAR</p>
                <h2 id="upload-title">添加数字人</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                title="关闭"
                onClick={() => setUploadOpen(false)}
                disabled={busy === 'upload'}
              >
                <X size={18} />
              </button>
            </header>
            <form onSubmit={submitModel}>
              <label className="field-label" htmlFor="avatar-name">
                形象名称
              </label>
              <input
                id="avatar-name"
                className="text-input"
                value={uploadName}
                onChange={(event) => setUploadName(event.target.value)}
                placeholder="给这个形象起个名字"
                maxLength={80}
                required
              />
              <label className="field-label upload-label" htmlFor="avatar-video">
                人物参考视频 <span>必需</span>
              </label>
              <label
                className={uploadFile ? 'dropzone has-file' : 'dropzone'}
                htmlFor="avatar-video"
              >
                <input
                  id="avatar-video"
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.avi"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                />
                <CloudUpload size={23} />
                <b>{uploadFile ? uploadFile.name : '选择视频文件'}</b>
                <span>
                  {uploadFile
                    ? `${(uploadFile.size / 1024 / 1024).toFixed(1)} MB`
                    : 'MP4、MOV、MKV、WebM 或 AVI，建议包含清晰人声'}
                </span>
                <FolderOpen size={16} className="dropzone-folder" />
              </label>
              <div className="upload-note">
                <Cpu size={15} />
                <span>
                  只需这一个视频：系统会提取画面用于口型合成，并提取语音训练声音。无需另传音频或图片；没有清晰人声的视频无法训练声音。
                </span>
              </div>
              <div className="dialog-actions">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setUploadOpen(false)}
                  disabled={busy === 'upload'}
                >
                  取消
                </button>
                <button className="primary-button" type="submit" disabled={busy !== null}>
                  {busy === 'upload' ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <CloudUpload size={17} />
                  )}
                  {busy === 'upload' ? '处理中' : '上传并训练'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

function TaskList({ tasks, expanded = false }: { tasks: Task[]; expanded?: boolean }) {
  if (!tasks.length)
    return (
      <div className="empty-tasks">
        <Clapperboard size={21} />
        <span>还没有合成记录</span>
        <small>创建视频后，任务进度会显示在这里。</small>
      </div>
    )

  return (
    <div className={expanded ? 'task-list expanded' : 'task-list'}>
      {tasks.map((task) => (
        <article className="task-row" key={task.id}>
          <span className={`task-status status-${task.status}`}>
            <i />
            {statusLabel(task.status)}
          </span>
          <div className="task-title">
            <b>{task.name}</b>
            <span>
              {task.text.slice(0, 72)}
              {task.text.length > 72 ? '…' : ''}
            </span>
          </div>
          <span className="task-time">{formatTime(task.createdAt)}</span>
          {task.status === 'processing' ? (
            <div className="progress-wrap">
              <div className="progress-track">
                <i style={{ width: `${Math.min(Math.max(task.progress || 4, 4), 100)}%` }} />
              </div>
              <small>{task.progress || 0}%</small>
            </div>
          ) : task.status === 'completed' ? (
            <a
              className="download-button"
              href={`/api/media?taskId=${task.id}`}
              title="下载合成视频"
              download
            >
              <ArrowDownToLine size={17} />
            </a>
          ) : (
            <span className="task-error">{task.message || '请检查服务状态'}</span>
          )}
        </article>
      ))}
    </div>
  )
}
