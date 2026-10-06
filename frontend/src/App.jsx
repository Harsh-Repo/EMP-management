import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react'
import api, {
  clearTokens,
  fetchWorkspaceData,
  getRefreshToken,
  hasSavedTokens,
  logoutSession,
  saveTokens,
} from './api'

const navigation = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Employees', icon: UsersRound },
  { label: 'Departments', icon: Building2 },
  { label: 'Projects', icon: BriefcaseBusiness },
  { label: 'Reports', icon: ChartNoAxesCombined },
]

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})
const longDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: '2-digit',
  year: 'numeric',
}).format(new Date()).toUpperCase()
const shortDate = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: '2-digit',
}).format(new Date()).toUpperCase()

function initials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '??'
}

function departmentName(id, departments) {
  return departments.find((department) => String(department.id) === String(id))?.name ?? 'Unassigned'
}

function readableError(error) {
  const data = error?.response?.data
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') return Object.values(data).flat().join(' ')
  return error?.message || 'Something went wrong. Please try again.'
}

function App() {
  const [auth, setAuth] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const [activePage, setActivePage] = useState('Dashboard')
  const [employees, setEmployees] = useState([])
  const [departments, setDepartments] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [detail, setDetail] = useState(null)
  const [reportInsights, setReportInsights] = useState({ highest: null, secondHighest: [], departmentPayroll: [] })
  const [notice, setNotice] = useState('')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  async function loadData() {
    setLoading(true)
    const result = await fetchWorkspaceData()
    setEmployees(result.employees)
    setDepartments(result.departments)
    setProjects(result.projects)
    setApiError(result.errors.length ? readableError(result.errors[0]) : '')
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    const handleExpiredSession = () => {
      setAuth(null)
      setAuthReady(true)
      setAuthError('Your session expired. Please sign in again.')
    }
    window.addEventListener('auth:expired', handleExpiredSession)

    if (!hasSavedTokens()) {
      setAuthReady(true)
    } else {
      api.get('/auth/me/')
        .then(({ data }) => { if (mounted) setAuth(data) })
        .catch(() => {
          clearTokens()
          if (mounted) setAuth(null)
        })
        .finally(() => { if (mounted) setAuthReady(true) })
    }

    return () => {
      mounted = false
      window.removeEventListener('auth:expired', handleExpiredSession)
    }
  }, [])

  useEffect(() => {
    if (auth) loadData()
  }, [auth])

  useEffect(() => {
    if (activePage !== 'Reports') return undefined
    let mounted = true
    Promise.allSettled([
      api.get('/employees/highest-salary/'),
      api.get('/employees/second-highest-salary/'),
      api.get('/departments/total-salary/'),
    ]).then(([highest, secondHighest, departmentPayroll]) => {
      if (!mounted) return
      setReportInsights({
        highest: highest.status === 'fulfilled' ? highest.value.data : null,
        secondHighest: secondHighest.status === 'fulfilled' ? secondHighest.value.data : [],
        departmentPayroll: departmentPayroll.status === 'fulfilled' ? departmentPayroll.value.data : [],
      })
    })
    return () => { mounted = false }
  }, [activePage])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const payroll = useMemo(
    () => employees.reduce((total, employee) => total + Number(employee.salary || 0), 0),
    [employees],
  )
  const filteredEmployees = employees.filter((employee) => {
    const text = `${employee.name} ${employee.designation} ${departmentName(employee.department, departments)}`
    return text.toLowerCase().includes(search.toLowerCase())
  })
  const canManage = Boolean(auth?.is_staff)

  async function handleLogin(username, password) {
    setAuthError('')
    try {
      const { data: tokens } = await api.post('/auth/token/', { username, password })
      saveTokens(tokens)
      const { data: user } = await api.get('/auth/me/')
      setAuth(user)
    } catch (error) {
      clearTokens()
      setAuthError(readableError(error))
    }
  }

  async function handleLogout() {
    try {
      if (getRefreshToken()) await logoutSession()
    } catch {
      setNotice('Signed out locally; the server could not revoke this token.')
    }
    clearTokens()
    setAuth(null)
    setEmployees([])
    setDepartments([])
    setProjects([])
  }

  async function saveEmployee(values) {
    if (modal?.item) {
      await api.put(`/employees/${modal.item.id}/`, values)
      setNotice('Employee details updated')
    } else {
      await api.post('/employees/', values)
      setNotice('Employee added to the team')
    }
    setModal(null)
    await loadData()
  }

  async function deleteEmployee(employee) {
    if (!window.confirm(`Remove ${employee.name} from the team?`)) return
    try {
      await api.delete(`/employees/${employee.id}/`)
      setNotice('Employee removed')
      await loadData()
    } catch (error) {
      setNotice(readableError(error))
    }
  }

  async function saveDepartment(values) {
    if (modal?.item) {
      await api.put(`/departments/${modal.item.id}/`, values)
      setNotice('Department updated')
    } else {
      await api.post('/departments/', values)
      setNotice('Department created')
    }
    setModal(null)
    await loadData()
  }

  async function deleteDepartment(department) {
    if (!window.confirm(`Delete ${department.name}? Departments with employees cannot be deleted.`)) return
    try {
      await api.delete(`/departments/${department.id}/`)
      setNotice('Department deleted')
      await loadData()
    } catch (error) {
      setNotice(readableError(error))
    }
  }

  async function saveProject(values) {
    await api.post('/projects/', values)
    setModal(null)
    setNotice('Project created')
    await loadData()
  }

  async function openEmployee(employee) {
    setDetail({ type: 'employee', loading: true })
    try {
      const [employeeResponse, departmentResponse] = await Promise.all([
        api.get(`/employees/${employee.id}/`),
        api.get(`/employees/${employee.id}/department/`),
      ])
      setDetail({ type: 'employee', item: employeeResponse.data, department: departmentResponse.data })
    } catch (error) {
      setDetail({ type: 'employee', item: employee, error: readableError(error) })
    }
  }

  async function openDepartment(department) {
    setDetail({ type: 'department', loading: true })
    try {
      const response = await api.get(`/departments/${department.id}/`)
      setDetail({ type: 'department', item: response.data })
    } catch (error) {
      setDetail({ type: 'department', item: department, error: readableError(error) })
    }
  }

  async function openProject(project) {
    setDetail({ type: 'project', loading: true })
    try {
      const [projectResponse, budgetResponse] = await Promise.all([
        api.get(`/projects/${project.id}/`),
        api.get(`/projects/${project.id}/budget/`),
      ])
      setDetail({ type: 'project', item: projectResponse.data, budget: budgetResponse.data.budget })
    } catch (error) {
      setDetail({ type: 'project', item: project, error: readableError(error) })
    }
  }

  async function addProjectMember(projectId, employeeId) {
    try {
      const response = await api.put(`/projects/${projectId}/add-member/`, { employee_id: employeeId })
      const budgetResponse = await api.get(`/projects/${projectId}/budget/`)
      setDetail({ type: 'project', item: response.data, budget: budgetResponse.data.budget })
      setNotice('Teammate added to project')
      await loadData()
    } catch (error) {
      setNotice(readableError(error))
    }
  }

  async function updateProjectStatus(projectId, status) {
    try {
      const response = await api.put(`/projects/${projectId}/update-status/`, { status })
      setDetail((current) => current?.type === 'project' ? { ...current, item: response.data } : current)
      setNotice('Project status updated')
      await loadData()
    } catch (error) {
      setNotice(readableError(error))
    }
  }

  async function deleteProject(project) {
    if (!window.confirm(`Delete ${project.name}? The API only allows deleting projects after their end date.`)) return
    try {
      await api.delete(`/projects/${project.id}/`)
      setDetail(null)
      setNotice('Project deleted')
      await loadData()
    } catch (error) {
      setNotice(readableError(error))
    }
  }

  if (!authReady) {
    return <div className="auth-loading"><LoaderCircle className="spin" size={24} /><span>Checking your session...</span></div>
  }

  if (!auth) return <LoginScreen onSubmit={handleLogin} error={authError} />

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span /></div>
          <div><strong>fieldwork</strong><small>PEOPLE OPERATIONS</small></div>
          <button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></button>
        </div>

        <div className="workspace-switcher">
          <div className="workspace-monogram">N</div>
          <div className="workspace-copy"><strong>Northstar Studio</strong><span>Workspace</span></div>
          <ChevronDown size={15} />
        </div>

        <p className="nav-caption">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              className={`nav-link ${activePage === label ? 'nav-link-active' : ''}`}
              key={label}
              onClick={() => { setActivePage(label); setMobileNavOpen(false) }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === 'Employees' && <span className="nav-count">{employees.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-tip">
          <div className="tip-icon"><Sparkles size={17} /></div>
          <strong>People first, always.</strong>
          <p>A little clarity goes a long way in building a great team.</p>
          <button onClick={() => setActivePage('Reports')}>Explore team insights <ArrowUpRight size={14} /></button>
        </div>
        <div className="sidebar-bottom">
          <button className="nav-link"><CircleHelp size={18} /><span>Help center</span></button>
          <div className="profile-row">
            <div className="profile-avatar">JD</div>
            <div className="profile-copy"><strong>{auth.username}</strong><span>{canManage ? 'Staff manager' : 'Read-only member'}</span></div>
            <button className="icon-button" title="Sign out" aria-label="Sign out" onClick={handleLogout}><LogOut size={16} /></button>
          </div>
        </div>
      </aside>

      {mobileNavOpen && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-trigger" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{activePage}</strong></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={16} /><input value={search} onChange={(event) => { setSearch(event.target.value); if (event.target.value) setActivePage('Employees') }} placeholder="Search people..." /><kbd>⌘ K</kbd></label>
            <span className="today-label">{shortDate}</span>
          </div>
        </header>

        <div className="page-content">
          {apiError && (
            <div className="api-banner" role="alert">
              <span><strong>Some data could not be loaded.</strong> Check that Django is running at 127.0.0.1:8000.</span>
              <button onClick={loadData}>Retry</button>
            </div>
          )}
          {loading && !employees.length && !departments.length && !projects.length ? (
            <div className="loading-state"><LoaderCircle className="spin" size={24} /><span>Connecting to your workspace...</span></div>
          ) : (
            <>
              {activePage === 'Dashboard' && <Dashboard employees={employees} departments={departments} projects={projects} payroll={payroll} canManage={canManage} setActivePage={setActivePage} setModal={setModal} onOpenProject={openProject} />}
              {activePage === 'Employees' && <EmployeesPage employees={filteredEmployees} departments={departments} search={search} setSearch={setSearch} canManage={canManage} setModal={setModal} onDelete={deleteEmployee} onView={openEmployee} />}
              {activePage === 'Departments' && <DepartmentsPage departments={departments} employees={employees} canManage={canManage} setModal={setModal} onDelete={deleteDepartment} onView={openDepartment} />}
              {activePage === 'Projects' && <ProjectsPage projects={projects} employees={employees} canManage={canManage} setModal={setModal} onOpenProject={openProject} />}
              {activePage === 'Reports' && <ReportsPage employees={employees} departments={departments} projects={projects} payroll={payroll} insights={reportInsights} />}
            </>
          )}
        </div>
      </main>

      {modal && <DataModal modal={modal} departments={departments} employees={employees} onClose={() => setModal(null)} onSave={modal.type === 'employee' ? saveEmployee : modal.type === 'department' ? saveDepartment : saveProject} />}
      {detail && <DetailModal detail={detail} employees={employees} departments={departments} canManage={canManage} onClose={() => setDetail(null)} onAddMember={addProjectMember} onUpdateProjectStatus={updateProjectStatus} onDeleteProject={deleteProject} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}

function LoginScreen({ onSubmit, error }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    await onSubmit(username, password)
    setSubmitting(false)
  }

  return (
    <main className="auth-screen">
      <section className="auth-story">
        <div className="brand-lockup auth-brand"><div className="brand-mark"><span /></div><div><strong>fieldwork</strong><small>PEOPLE OPERATIONS</small></div></div>
        <div className="auth-story-copy"><p className="eyebrow">NORTHSTAR STUDIO</p><h1>Good work<br />starts with people.</h1><p>A thoughtful place to keep your people and projects moving together.</p></div>
        <span className="auth-story-foot">A calmer way to work, together.</span>
      </section>
      <section className="auth-form-side">
        <form className="auth-form" onSubmit={submit}>
          <p className="eyebrow">WELCOME BACK</p>
          <h2>Sign in to Fieldwork</h2>
          <p className="auth-subtitle">Use your workspace username and password.</p>
          <label className="form-field" htmlFor="login-username">Username<input id="login-username" autoComplete="username" autoFocus required value={username} onChange={(event) => setUsername(event.target.value)} /></label>
          <label className="form-field" htmlFor="login-password">Password<input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="action-button auth-submit" type="submit" disabled={submitting}>{submitting ? <LoaderCircle className="spin" size={16} /> : null}{submitting ? 'Signing in...' : 'Sign in'}</button>
          <p className="auth-help">Accounts are managed by your Django administrator.</p>
        </form>
      </section>
    </main>
  )
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="heading-subtitle">{subtitle}</p></div>
      {action}
    </div>
  )
}

function ActionButton({ children, onClick, secondary = false }) {
  return <button className={`action-button ${secondary ? 'action-secondary' : ''}`} onClick={onClick}>{children}</button>
}

function Dashboard({ employees, departments, projects, payroll, canManage, setActivePage, setModal, onOpenProject }) {
  const departmentCounts = departments.map((department) => ({
    ...department,
    count: employees.filter((employee) => String(employee.department) === String(department.id)).length,
  })).sort((a, b) => b.count - a.count)
  const maxCount = Math.max(...departmentCounts.map((department) => department.count), 1)
  const latestEmployees = [...employees].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 5)
  const running = projects.filter((project) => project.status === 'ON-GOING')

  return (
    <>
      <PageHeading
        eyebrow={longDate}
        title="A good day to build together."
        subtitle="Here’s the latest on your people and projects."
        action={canManage && <ActionButton onClick={() => setModal({ type: 'employee' })}><Plus size={17} /> Add employee</ActionButton>}
      />

      <section className="metrics-grid" aria-label="Team overview">
        <MetricCard label="People on the team" value={employees.length} note="Across all departments" icon={<UsersRound size={18} />} color="mint" />
        <MetricCard label="Departments" value={departments.length} note="Teams working together" icon={<Building2 size={18} />} color="peach" />
        <MetricCard label="Projects in motion" value={running.length} note={`${projects.length} total projects`} icon={<BriefcaseBusiness size={18} />} color="blue" />
        <MetricCard label="Monthly payroll" value={currency.format(payroll / 12)} note="Based on annual salaries" icon={<ChartNoAxesCombined size={18} />} color="yellow" />
      </section>

      <section className="insights-grid">
        <div className="surface department-chart">
          <div className="section-heading"><div><p className="eyebrow">TEAM SHAPE</p><h2>People by department</h2></div><button className="text-button" onClick={() => setActivePage('Departments')}>All departments <ArrowUpRight size={15} /></button></div>
          {departmentCounts.length ? (
            <div className="bar-chart">
              {departmentCounts.slice(0, 5).map((department, index) => (
                <div className="bar-row" key={department.id}>
                  <span className="bar-name">{department.name}</span>
                  <div className="bar-track"><span className={`bar-fill bar-fill-${index % 5}`} style={{ width: `${Math.max((department.count / maxCount) * 100, department.count ? 8 : 0)}%` }} /></div>
                  <span className="bar-value">{department.count}</span>
                </div>
              ))}
            </div>
          ) : <EmptyInline title="No departments yet" detail="Add a department to see your team take shape." />}
          <div className="chart-footnote"><span className="legend-dot" /> Current team size <span className="footnote-total">{employees.length} people</span></div>
        </div>

        <div className="surface project-snapshot">
          <div className="section-heading"><div><p className="eyebrow">IN THE WORKS</p><h2>Project pulse</h2></div><button className="icon-button" aria-label="View projects" onClick={() => setActivePage('Projects')}><ArrowUpRight size={17} /></button></div>
          {running.length ? running.slice(0, 3).map((project, index) => (
            <button className="project-line project-line-button" key={project.id} onClick={() => onOpenProject(project)}>
              <div className={`project-symbol project-symbol-${index % 3}`}><BriefcaseBusiness size={16} /></div>
              <div className="project-line-copy"><strong>{project.name}</strong><span>{project.team?.length ?? 0} team members</span></div>
              <span className="status-pill status-active"><i /> In progress</span>
            </button>
          )) : <EmptyInline title="Room for the next big thing" detail="Create a project to get it on the board." />}
          {canManage && <button className="project-add-link" onClick={() => setModal({ type: 'project' })}><Plus size={15} /> Start a project</button>}
        </div>
      </section>

      <section className="surface directory-preview">
        <div className="section-heading"><div><p className="eyebrow">YOUR PEOPLE</p><h2>Recently added</h2></div><button className="text-button" onClick={() => setActivePage('Employees')}>View directory <ArrowUpRight size={15} /></button></div>
        {latestEmployees.length ? <EmployeeTable employees={latestEmployees} departments={departments} compact /> : <EmptyInline title="Your directory is ready" detail="Add your first employee to bring the dashboard to life." />}
      </section>
    </>
  )
}

function MetricCard({ label, value, note, icon, color }) {
  return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className={`metric-icon metric-${color}`}>{icon}</span></div><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span></div>
}

function EmployeesPage({ employees, departments, search, setSearch, canManage, setModal, onDelete, onView }) {
  return (
    <>
      <PageHeading eyebrow="PEOPLE DIRECTORY" title="Employees" subtitle="The people who make the work matter." action={canManage && <ActionButton onClick={() => setModal({ type: 'employee' })}><Plus size={17} /> Add employee</ActionButton>} />
      <div className="list-toolbar"><div><strong>{employees.length}</strong> <span>people</span></div><label className="local-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a teammate" /></label></div>
      {employees.length ? <div className="surface table-surface"><EmployeeTable employees={employees} departments={departments} onEdit={canManage ? (employee) => setModal({ type: 'employee', item: employee }) : undefined} onDelete={canManage ? onDelete : undefined} onView={onView} /></div> : <EmptyState title="No matching teammates" detail="Try another name or add someone new to the directory." action={canManage && <ActionButton onClick={() => setModal({ type: 'employee' })}><Plus size={17} /> Add employee</ActionButton>} />}
    </>
  )
}

function EmployeeTable({ employees, departments, onEdit, onDelete, onView, compact = false }) {
  return (
    <div className="table-scroll"><table className="data-table"><thead><tr><th>NAME</th><th>ROLE</th><th>DEPARTMENT</th><th>ANNUAL SALARY</th><th>LOCATION</th>{!compact && <th />}</tr></thead>
      <tbody>{employees.map((employee, index) => <tr key={employee.id}>
        <td><div className="person-cell"><span className={`person-avatar avatar-${index % 6}`}>{initials(employee.name)}</span><span>{onView ? <button className="person-name-button" onClick={() => onView(employee)}><strong>{employee.name}</strong></button> : <strong>{employee.name}</strong>}<small>EMP-{String(employee.id).padStart(3, '0')}</small></span></div></td>
        <td>{employee.designation}</td><td><span className="department-tag">{departmentName(employee.department, departments)}</span></td>
        <td className="salary-cell">{currency.format(Number(employee.salary || 0))}</td><td className="location-cell">{employee.address || '—'}</td>
        {!compact && (onEdit || onDelete) && <td><div className="row-actions">{onEdit && <button className="icon-button" title="Edit employee" aria-label={`Edit ${employee.name}`} onClick={() => onEdit(employee)}><MoreHorizontal size={18} /></button>}{onDelete && <button className="quiet-delete" onClick={() => onDelete(employee)}>Remove</button>}</div></td>}
      </tr>)}</tbody></table></div>
  )
}

function DepartmentsPage({ departments, employees, canManage, setModal, onDelete, onView }) {
  return (
    <>
      <PageHeading eyebrow="HOW WE WORK" title="Departments" subtitle="Small teams, shared direction." action={canManage && <ActionButton onClick={() => setModal({ type: 'department' })}><Plus size={17} /> Add department</ActionButton>} />
      <section className="department-list">
        {departments.length ? departments.map((department, index) => {
          const team = employees.filter((employee) => String(employee.department) === String(department.id))
          const total = team.reduce((sum, employee) => sum + Number(employee.salary || 0), 0)
          return <article className="department-row" key={department.id}>
            <div className={`department-stamp stamp-${index % 5}`}><Building2 size={20} /></div>
            <div className="department-title"><button className="department-name-button" onClick={() => onView(department)}><h2>{department.name}</h2></button><span>{team.length} {team.length === 1 ? 'teammate' : 'teammates'}</span></div>
            <div className="department-people">{team.slice(0, 4).map((employee, personIndex) => <span className={`person-avatar avatar-${personIndex % 6}`} key={employee.id} title={employee.name}>{initials(employee.name)}</span>)}{team.length > 4 && <span className="avatar-overflow">+{team.length - 4}</span>}{!team.length && <span className="muted-copy">No members yet</span>}</div>
            <div className="department-payroll"><span>ANNUAL PAYROLL</span><strong>{currency.format(total)}</strong></div>
            {canManage && <div className="department-actions"><button className="text-button" onClick={() => setModal({ type: 'department', item: department })}>Edit</button><button className="quiet-delete" onClick={() => onDelete(department)}>Delete</button></div>}
          </article>
        }) : <EmptyState title="Start with a department" detail="Create a department, then assign teammates as you add them." action={canManage && <ActionButton onClick={() => setModal({ type: 'department' })}><Plus size={17} /> Add department</ActionButton>} />}
      </section>
    </>
  )
}

function ProjectsPage({ projects, employees, canManage, setModal, onOpenProject }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [filteredProjects, setFilteredProjects] = useState(projects)
  const [filterError, setFilterError] = useState('')
  const [filterLoading, setFilterLoading] = useState(false)

  useEffect(() => {
    if (statusFilter === 'ALL') {
      setFilteredProjects(projects)
      setFilterError('')
      setFilterLoading(false)
      return undefined
    }
    setFilterLoading(true)
    const endpoint = {
      NEW: '/projects/new/',
      'ON-GOING': '/projects/on-going/',
      ENDED: '/projects/ended/',
    }[statusFilter]
    let mounted = true
    api.get(endpoint).then((response) => {
      if (mounted) {
        setFilteredProjects(response.data)
        setFilterError('')
        setFilterLoading(false)
      }
    }).catch((error) => {
      if (mounted) {
        setFilterError(readableError(error))
        setFilterLoading(false)
      }
    })
    return () => { mounted = false }
  }, [statusFilter, projects])

  return (
    <>
      <PageHeading eyebrow="SHARED MOMENTUM" title="Projects" subtitle="See what the team is moving forward." action={canManage && <ActionButton onClick={() => setModal({ type: 'project' })}><Plus size={17} /> New project</ActionButton>} />
      <div className="project-filters" role="group" aria-label="Filter projects by status">{[['ALL', 'All projects'], ['NEW', 'Not started'], ['ON-GOING', 'In progress'], ['ENDED', 'Completed']].map(([value, label]) => <button key={value} className={statusFilter === value ? 'filter-active' : ''} onClick={() => { setFilterLoading(value !== 'ALL'); setStatusFilter(value) }}>{label}</button>)}</div>
      {filterError && <p className="form-error">{filterError}</p>}
      {filterLoading ? <div className="loading-state project-loading"><LoaderCircle className="spin" size={21} /><span>Loading projects...</span></div> : filteredProjects.length ? <div className="project-grid">{filteredProjects.map((project, index) => <article className="project-card project-card-clickable" key={project.id} role="button" tabIndex={0} onClick={() => onOpenProject(project)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onOpenProject(project) }}>
        <div className={`project-card-art art-${index % 4}`}><span className="project-card-index">PROJECT {String(index + 1).padStart(2, '0')}</span><BriefcaseBusiness size={30} strokeWidth={1.4} /></div>
        <div className="project-card-body"><div className="project-card-title"><h2>{project.name}</h2><span className={`status-pill ${project.status === 'ON-GOING' ? 'status-active' : project.status === 'ENDED' ? 'status-ended' : 'status-new'}`}><i />{project.status === 'ON-GOING' ? 'In progress' : project.status === 'ENDED' ? 'Completed' : 'Not started'}</span></div>
          <div className="project-dates"><span>{project.start_date || 'Start date TBD'}</span><span className="date-dash">→</span><span>{project.end_date || 'End date TBD'}</span></div>
          <div className="project-card-footer"><div className="team-stack">{(project.team || []).slice(0, 5).map((member, memberIndex) => <span className={`person-avatar avatar-${memberIndex % 6}`} key={member.id} title={member.name}>{initials(member.name)}</span>)}{!project.team?.length && <span className="muted-copy">No team assigned</span>}</div><span className="team-count">{project.team?.length ?? 0} / {employees.length} people</span></div>
        </div>
      </article>)}</div> : <EmptyState title={statusFilter === 'ALL' ? 'A blank canvas' : 'No projects in this status'} detail={statusFilter === 'ALL' ? 'Create your first project and bring the right people together.' : 'Choose another status or create a new project.'} action={canManage && <ActionButton onClick={() => setModal({ type: 'project' })}><Plus size={17} /> New project</ActionButton>} />}
    </>
  )
}

function ReportsPage({ employees, departments, projects, payroll, insights }) {
  const departmentData = departments.map((department) => ({
    ...department,
    count: employees.filter((employee) => String(employee.department) === String(department.id)).length,
    salary: employees.filter((employee) => String(employee.department) === String(department.id)).reduce((total, employee) => total + Number(employee.salary || 0), 0),
  })).sort((a, b) => b.salary - a.salary)
  const maxSalary = Math.max(...departmentData.map((department) => department.salary), 1)
  const statusCounts = [
    { label: 'In progress', count: projects.filter((project) => project.status === 'ON-GOING').length, className: 'report-progress' },
    { label: 'Not started', count: projects.filter((project) => project.status === 'NEW').length, className: 'report-new' },
    { label: 'Completed', count: projects.filter((project) => project.status === 'ENDED').length, className: 'report-completed' },
  ]
  return (
    <>
      <PageHeading eyebrow="THE BIG PICTURE" title="Reports" subtitle="A clearer view of your team, at a glance." />
      <section className="report-summary"><div><span>TEAM SIZE</span><strong>{employees.length}</strong><small>people across {departments.length} departments</small></div><div><span>ANNUAL PAYROLL</span><strong>{currency.format(payroll)}</strong><small>{currency.format(payroll / 12)} estimated monthly</small></div><div><span>PROJECT PORTFOLIO</span><strong>{projects.length}</strong><small>{statusCounts[0].count} currently in progress</small></div></section>
      <section className="reports-grid">
        <div className="surface report-panel"><div className="section-heading"><div><p className="eyebrow">COST BY TEAM</p><h2>Annual salary distribution</h2></div></div>
          {insights.departmentPayroll.length ? <div className="report-bars">{insights.departmentPayroll.map((department, index) => <div className="report-bar-row" key={department.department}><div className="report-bar-label"><strong>{department.department}</strong><span>{currency.format(Number(department.total_salary || 0))}</span></div><div className="bar-track"><span className={`bar-fill bar-fill-${index % 5}`} style={{ width: `${Math.max((Number(department.total_salary || 0) / maxSalary) * 100, department.total_salary ? 8 : 0)}%` }} /></div></div>)}</div> : departmentData.length ? <div className="report-bars">{departmentData.map((department, index) => <div className="report-bar-row" key={department.id}><div className="report-bar-label"><strong>{department.name}</strong><span>{department.count} people · {currency.format(department.salary)}</span></div><div className="bar-track"><span className={`bar-fill bar-fill-${index % 5}`} style={{ width: `${Math.max((department.salary / maxSalary) * 100, department.salary ? 8 : 0)}%` }} /></div></div>)}</div> : <EmptyInline title="No salary data yet" detail="Add employees to see a breakdown by department." />}
        </div>
        <div className="surface report-panel"><div className="section-heading"><div><p className="eyebrow">DELIVERY</p><h2>Project status</h2></div></div>
          <div className="status-report">{statusCounts.map((item) => <div className="status-report-row" key={item.label}><span className={`status-marker ${item.className}`} /><span>{item.label}</span><strong>{item.count}</strong></div>)}</div>
          <div className="project-total"><span>Total projects</span><strong>{projects.length}</strong></div>
        </div>
      </section>
      <section className="salary-insights">
        <div><p className="eyebrow">SALARY INSIGHTS</p><h2>Compensation snapshot</h2></div>
        <div className="salary-insight-item"><span>Highest paid</span>{insights.highest ? <strong>{insights.highest.name}<small>{currency.format(Number(insights.highest.salary))}</small></strong> : <strong>No salary data</strong>}</div>
        <div className="salary-insight-list"><span>Second highest by department</span>{insights.secondHighest.length ? insights.secondHighest.map((item) => <div key={item.department}><strong>{item.department}</strong><span>{item.employee} · {currency.format(Number(item.salary))}</span></div>) : <small>No department has two distinct salary levels yet.</small>}</div>
      </section>
      <p className="report-disclaimer"><ArrowDownRight size={15} /> Payroll figures are calculated from current employee salary records. They are not a substitute for payroll processing.</p>
    </>
  )
}

function EmptyInline({ title, detail }) {
  return <div className="empty-inline"><span className="empty-spark"><Sparkles size={16} /></span><div><strong>{title}</strong><p>{detail}</p></div></div>
}

function EmptyState({ title, detail, action }) {
  return <div className="empty-state"><span className="empty-state-icon"><UsersRound size={25} /></span><h2>{title}</h2><p>{detail}</p>{action}</div>
}

function DetailModal({ detail, employees, canManage, onClose, onAddMember, onUpdateProjectStatus, onDeleteProject }) {
  const [employeeId, setEmployeeId] = useState('')
  if (detail.loading) return <div className="modal-backdrop"><section className="modal-panel detail-modal"><LoaderCircle className="spin" size={22} /><span>Loading details...</span></section></div>

  const item = detail.item || {}
  const title = detail.type === 'project' ? item.name : detail.type === 'employee' ? item.name : item.name
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-panel detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
        <div className="modal-heading"><div><p className="eyebrow">{detail.type === 'project' ? 'PROJECT DETAILS' : detail.type === 'employee' ? 'EMPLOYEE PROFILE' : 'DEPARTMENT DETAILS'}</p><h2 id="detail-title">{title}</h2></div><button className="icon-button" aria-label="Close details" onClick={onClose}><X size={19} /></button></div>
        {detail.error && <p className="form-error" role="alert">{detail.error}</p>}
        {detail.type === 'project' && <>
          <div className="project-detail-overview"><div><span>PROJECT BUDGET</span><strong>{detail.budget == null ? 'Unavailable' : currency.format(Number(detail.budget))}</strong><small>Sum of annual salaries for project members</small></div>{canManage ? <label className="form-field">Status<select value={item.status || 'NEW'} onChange={(event) => onUpdateProjectStatus(item.id, event.target.value)}><option value="NEW">Not started</option><option value="ON-GOING">In progress</option><option value="ENDED">Completed</option></select></label> : <div className="detail-readonly-status"><span>STATUS</span><strong>{item.status === 'ON-GOING' ? 'In progress' : item.status === 'ENDED' ? 'Completed' : 'Not started'}</strong></div>}</div>
          <div className="project-detail-meta"><span>{item.start_date || 'No start date'}</span><span>to</span><span>{item.end_date || 'No end date'}</span>{item.team_lead && <span className="lead-label">Lead: {item.team_lead.name}</span>}</div>
          <div className="detail-section-heading"><div><p className="eyebrow">PROJECT TEAM</p><h3>{item.team?.length || 0} {item.team?.length === 1 ? 'person' : 'people'}</h3></div></div>
          {item.team?.length ? <div className="member-list">{item.team.map((member, index) => <div className="member-row" key={member.id}><span className={`person-avatar avatar-${index % 6}`}>{initials(member.name)}</span><span className="member-copy"><strong>{member.name}</strong><small>{member.designation} · {member.address}</small></span><span className="salary-cell">{currency.format(Number(member.salary || 0))}</span></div>)}</div> : <EmptyInline title="No one assigned yet" detail="Add teammates below to build the project team." />}
          {canManage && <form className="add-member-form" onSubmit={(event) => { event.preventDefault(); if (employeeId) { onAddMember(item.id, Number(employeeId)); setEmployeeId('') } }}><label className="form-field">Add a teammate<select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Choose an employee</option>{employees.filter((employee) => !(item.team || []).some((member) => String(member.id) === String(employee.id))).map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.designation}</option>)}</select></label><button className="action-button" type="submit" disabled={!employeeId}><Plus size={16} /> Add member</button></form>}
          <div className="detail-footer">{canManage && <button className="quiet-delete" onClick={() => onDeleteProject(item)}>Delete project</button>}<button className="action-button action-secondary" onClick={onClose}>Done</button></div>
        </>}
        {detail.type === 'employee' && <div className="record-details"><div className="record-person"><span className="person-avatar avatar-1">{initials(item.name)}</span><div><strong>{item.designation}</strong><small>{detail.department?.name || 'Department unavailable'}</small></div></div><div className="record-facts"><span>Annual salary<strong>{currency.format(Number(item.salary || 0))}</strong></span><span>Location<strong>{item.address || '—'}</strong></span><span>Employee ID<strong>EMP-{String(item.id).padStart(3, '0')}</strong></span></div></div>}
        {detail.type === 'department' && <><div className="department-detail-summary"><span>{item.employees?.length || 0} team members</span><span>{currency.format((item.employees || []).reduce((sum, employee) => sum + Number(employee.salary || 0), 0))} annual salary total</span></div>{item.employees?.length ? <div className="member-list">{item.employees.map((employee, index) => <div className="member-row" key={employee.id}><span className={`person-avatar avatar-${index % 6}`}>{initials(employee.name)}</span><span className="member-copy"><strong>{employee.name}</strong><small>{employee.designation}</small></span><span className="salary-cell">{currency.format(Number(employee.salary || 0))}</span></div>)}</div> : <EmptyInline title="No employees yet" detail="Employees assigned to this department will appear here." />}<div className="detail-footer"><button className="action-button action-secondary" onClick={onClose}>Done</button></div></>}
      </section>
    </div>
  )
}

function DataModal({ modal, departments, employees, onClose, onSave }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const item = modal.item || {}
  const [values, setValues] = useState(modal.type === 'employee'
    ? { name: item.name || '', designation: item.designation || '', salary: item.salary ?? '', department: item.department || '', address: item.address || '' }
    : modal.type === 'department'
      ? { name: item.name || '' }
      : { name: '', status: 'NEW', start_date: '', end_date: '', team_lead: '', team: [] })

  function update(field, value) {
    setValues((current) => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    const payload = { ...values }
    if (modal.type === 'employee') payload.salary = Number(payload.salary)
    if (modal.type === 'project') {
      payload.team = payload.team.map(Number)
      payload.team_lead = payload.team_lead ? Number(payload.team_lead) : null
    }
    try {
      await onSave(payload)
    } catch (requestError) {
      setError(readableError(requestError))
      setSaving(false)
    }
  }

  const title = modal.type === 'employee' ? (modal.item ? 'Edit teammate' : 'Add a teammate') : modal.type === 'department' ? (modal.item ? 'Edit department' : 'New department') : 'Start a project'
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><p className="eyebrow">{modal.type === 'employee' ? 'PEOPLE DIRECTORY' : modal.type === 'department' ? 'TEAM STRUCTURE' : 'PROJECTS'}</p><h2 id="modal-title">{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></div>
        <form onSubmit={submit}>
          {modal.type === 'employee' && <>
            <label className="form-field">Full name<input autoFocus required value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Alex Morgan" /></label>
            <div className="form-row"><label className="form-field">Job title<input required value={values.designation} onChange={(event) => update('designation', event.target.value)} placeholder="e.g. Product designer" /></label><label className="form-field">Annual salary<input required type="number" min="0" step="100" value={values.salary} onChange={(event) => update('salary', event.target.value)} placeholder="68000" /></label></div>
            <div className="form-row"><label className="form-field">Department<select required value={values.department} onChange={(event) => update('department', event.target.value)}><option value="">Choose a department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label><label className="form-field">Location<input required value={values.address} onChange={(event) => update('address', event.target.value)} placeholder="e.g. Brooklyn, NY" /></label></div>
          </>}
          {modal.type === 'department' && <label className="form-field">Department name<input autoFocus required value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Design" /></label>}
          {modal.type === 'project' && <>
            <label className="form-field">Project name<input autoFocus required value={values.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Spring refresh" /></label>
            <div className="form-row"><label className="form-field">Start date<input required type="date" value={values.start_date} onChange={(event) => update('start_date', event.target.value)} /></label><label className="form-field">End date<input required type="date" value={values.end_date} onChange={(event) => update('end_date', event.target.value)} /></label></div>
            <label className="form-field">Project lead<select value={values.team_lead} onChange={(event) => update('team_lead', event.target.value)}><option value="">No lead yet</option>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name}</option>)}</select></label>
            <label className="form-field">Team members<select multiple value={values.team.map(String)} onChange={(event) => update('team', Array.from(event.target.selectedOptions, (option) => option.value))}>{employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name}</option>)}</select><small className="field-hint">Use Ctrl (Windows) or Command (Mac) to select multiple people.</small></label>
            <label className="form-field">Status<select value={values.status} onChange={(event) => update('status', event.target.value)}><option value="NEW">Not started</option><option value="ON-GOING">In progress</option><option value="ENDED">Completed</option></select></label>
          </>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="modal-actions"><button type="button" className="action-button action-secondary" onClick={onClose}>Cancel</button><button type="submit" className="action-button" disabled={saving}>{saving && <LoaderCircle className="spin" size={16} />}{saving ? 'Saving...' : modal.item ? 'Save changes' : modal.type === 'project' ? 'Create project' : modal.type === 'department' ? 'Create department' : 'Add to directory'}</button></div>
        </form>
      </section>
    </div>
  )
}

export default App