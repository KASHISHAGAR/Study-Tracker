/* Study Tracker — app.js
   Features:
   - Add/Edit/Delete tasks (name, category, date, priority)
   - Calendar (month nav) with colored dots per category
   - Click day to open modal with tasks for that day
   - Filters (category, priority, status) + search
   - Progress bar
   - Drag & Drop tasks onto calendar day to change date
   - Persistent using localStorage
*/

(() => {
  /* ---------- Elements ---------- */
  const taskForm = document.getElementById('taskForm');
  const taskName = document.getElementById('taskName');
  const taskCategory = document.getElementById('taskCategory');
  const taskDate = document.getElementById('taskDate');
  const taskPriority = document.getElementById('taskPriority');
  const clearFormBtn = document.getElementById('clearForm');

  const filterCategory = document.getElementById('filterCategory');
  const filterPriority = document.getElementById('filterPriority');
  const filterStatus = document.getElementById('filterStatus');
  const searchInput = document.getElementById('search');

  const calendarGrid = document.getElementById('calendarGrid');
  const monthYear = document.getElementById('monthYear');
  const prevMonth = document.getElementById('prevMonth');
  const nextMonth = document.getElementById('nextMonth');

  const tasksContainer = document.getElementById('tasksContainer');
  const taskCount = document.getElementById('taskCount');

  const miniProgressFill = document.getElementById('miniProgressFill');
  const miniProgressText = document.getElementById('miniProgressText');

  const dayModal = document.getElementById('dayModal');
  const modalTasks = document.getElementById('modalTasks');
  const modalDateTitle = document.getElementById('modalDateTitle');
  const closeModal = document.getElementById('closeModal');

  /* ---------- State ---------- */
  let tasks = JSON.parse(localStorage.getItem('study_tasks') || '[]');
  let currentDate = new Date(); // month/year displayed
  let filters = { category: 'All', priority: 'All', status: 'All', search: '' };
  let dragTaskId = null;

  /* ---------- Utilities ---------- */
  function uid(){ return Date.now() + Math.floor(Math.random()*999) }
  function formatDateISO(d){ // input: Date object
    return d.toISOString().split('T')[0];
  }
  function parseISO(s){ return new Date(s + 'T00:00:00') }
  function save(){ localStorage.setItem('study_tasks', JSON.stringify(tasks)); }

  function categoryColor(cat){
    switch(cat){
      case 'Homework': return getComputedStyle(document.documentElement).getPropertyValue('--cat-homework').trim() || '#ff8aa0';
      case 'Exam': return getComputedStyle(document.documentElement).getPropertyValue('--cat-exam').trim() || '#c099ff';
      case 'Project': return getComputedStyle(document.documentElement).getPropertyValue('--cat-project').trim() || '#7fc7ff';
      case 'Personal Study': return getComputedStyle(document.documentElement).getPropertyValue('--cat-personal').trim() || '#ffd86b';
      default: return '#ddd';
    }
  }

  /* ---------- Rendering: Calendar ---------- */
  function renderCalendar(){
    calendarGrid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();

    monthYear.textContent = currentDate.toLocaleString('default',{month:'long', year:'numeric'});

    // empty slots
    for(let i=0;i<firstDayIndex;i++){
      const e = document.createElement('div'); calendarGrid.appendChild(e);
    }

    for(let d=1; d<=daysInMonth; d++){
      const cell = document.createElement('div');
      cell.className = 'calendar-day';
      const dateISO = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

      const dateNum = document.createElement('div'); dateNum.className='date-num'; dateNum.textContent = d;
      cell.appendChild(dateNum);

      // tasks for day respecting filters (except search which applies to list too)
      const dayTasks = tasks.filter(t => t.date === dateISO);

      if(dayTasks.length){
        const dots = document.createElement('div'); dots.className = 'task-dots';
        dayTasks.forEach(t=>{
          const dot = document.createElement('span'); dot.className = 'task-dot';
          dot.style.background = categoryColor(t.category);
          dot.title = `${t.name} (${t.category})`;
          dots.appendChild(dot);
        });
        cell.appendChild(dots);
      }

      // highlight today
      const todayISO = formatDateISO(new Date());
      if(dateISO === todayISO) cell.classList.add('today');

      // click opens modal with all tasks for that day
      cell.addEventListener('click', (e) => {
        openDayModal(dateISO);
      });

      // drag over & drop support (for dropping task onto day to change date)
      cell.addEventListener('dragover', (ev)=>{ ev.preventDefault(); cell.style.boxShadow = '0 14px 40px rgba(0,0,0,0.08)'; });
      cell.addEventListener('dragleave', ()=>{ cell.style.boxShadow = ''; });
      cell.addEventListener('drop', (ev)=>{
        ev.preventDefault();
        cell.style.boxShadow = '';
        if(dragTaskId){
          // update that task date
          const task = tasks.find(t=>t.id===dragTaskId);
          if(task){
            task.date = dateISO;
            save(); renderAll();
            showToast(`Moved "${task.name}" to ${dateISO}`);
          }
        }
        dragTaskId = null;
      });

      calendarGrid.appendChild(cell);
    }
  }

  /* ---------- Rendering: Tasks List (cards) ---------- */
  function renderTasksList(){
    const list = tasks
      .filter(t => (filters.category === 'All' || t.category === filters.category))
      .filter(t => (filters.priority === 'All' || t.priority === filters.priority))
      .filter(t => (filters.status === 'All' || (filters.status === 'Completed' ? t.completed : !t.completed)))
      .filter(t => t.name.toLowerCase().includes(filters.search.toLowerCase()));

    // sort by date (asc) then priority
    list.sort((a,b)=>{
      if(a.date === b.date) return priorityOrder(b.priority) - priorityOrder(a.priority);
      return a.date.localeCompare(b.date);
    });

    tasksContainer.innerHTML = '';
    list.forEach(t=>{
      const card = document.createElement('div'); card.className = 'task-card';
      card.draggable = true;
      card.dataset.id = t.id;

      // dragstart
      card.addEventListener('dragstart', ()=>{ dragTaskId = t.id; setTimeout(()=>card.classList.add('dragging'), 10) });
      card.addEventListener('dragend', ()=>{ dragTaskId = null; card.classList.remove('dragging') });

      const left = document.createElement('div'); left.className='task-left';
      const meta = document.createElement('div'); meta.className='task-meta';
      const title = document.createElement('strong'); title.textContent = t.name;
      const small = document.createElement('small'); small.textContent = `${t.category} • ${t.date}`;
      meta.appendChild(title); meta.appendChild(small);

      const tag = document.createElement('span'); tag.className='tag ' + priorityClass(t.priority);
      tag.textContent = t.priority;

      left.appendChild(meta);

      const right = document.createElement('div'); right.className='task-actions';
      const btnComplete = document.createElement('button'); btnComplete.className='btn-complete task-btn';
      btnComplete.textContent = t.completed ? 'Undo' : 'Complete';
      btnComplete.addEventListener('click', ()=>{ toggleComplete(t.id) });
      const btnEdit = document.createElement('button'); btnEdit.className='btn-edit task-btn'; btnEdit.textContent='Edit';
      btnEdit.addEventListener('click', ()=> openEditPrompt(t.id));
      const btnDelete = document.createElement('button'); btnDelete.className='btn-delete task-btn'; btnDelete.textContent='Delete';
      btnDelete.addEventListener('click', ()=> { if(confirm('Delete this task?')) { deleteTask(t.id) } });

      right.appendChild(tag); right.appendChild(btnComplete); right.appendChild(btnEdit); right.appendChild(btnDelete);

      card.appendChild(left); card.appendChild(right);
      tasksContainer.appendChild(card);
    });

    // update task count
    const total = list.length;
    document.getElementById('taskCount') && (document.getElementById('taskCount').textContent = `(${total})`);
  }

  /* ---------- Helpers ---------- */
  function priorityOrder(p){
    if(p==='High') return 3;
    if(p==='Medium') return 2;
    return 1;
  }
  function priorityClass(p){
    if(p==='High') return 'priority-high';
    if(p==='Medium') return 'priority-medium';
    return 'priority-low';
  }

  /* ---------- Task CRUD ---------- */
  function addTask(obj){
    tasks.push(obj); save(); renderAll();
  }
  function toggleComplete(id){
    const t = tasks.find(x=>x.id===id); if(!t) return;
    t.completed = !t.completed; save(); renderAll();
  }
  function deleteTask(id){
    tasks = tasks.filter(x=>x.id!==id); save(); renderAll();
  }

  function openEditPrompt(id){
    const t = tasks.find(x=>x.id===id); if(!t) return;
    // simple prompt-based edit
    const newName = prompt('Edit task name', t.name); if(newName===null) return;
    const newDate = prompt('Edit date (YYYY-MM-DD)', t.date); if(newDate===null) return;
    const newCategory = prompt('Edit category (Homework/Exam/Project/Personal Study)', t.category); if(newCategory===null) return;
    const newPriority = prompt('Edit priority (Low/Medium/High)', t.priority); if(newPriority===null) return;
    t.name = newName.trim() || t.name; t.date = newDate || t.date; t.category = newCategory || t.category; t.priority = newPriority || t.priority;
    save(); renderAll();
  }

  /* ---------- Modal for clicked day ---------- */
  function openDayModal(dateISO){
    dayModal.classList.remove('hidden'); dayModal.setAttribute('aria-hidden','false');
    modalDateTitle.textContent = `Tasks on ${dateISO}`;
    modalTasks.innerHTML = '';
    const dayList = tasks.filter(t => t.date === dateISO);
    if(dayList.length===0){
      modalTasks.innerHTML = `<div class="card">No tasks for this day.</div>`;
    } else {
      dayList.forEach(t=>{
        const row = document.createElement('div'); row.className='task-card';
        row.style.alignItems = 'center';
        const left = document.createElement('div'); left.className='task-left';
        const meta = document.createElement('div'); meta.className='task-meta';
        const name = document.createElement('strong'); name.textContent = t.name;
        const small = document.createElement('small'); small.textContent = `${t.category} • ${t.priority}`;
        meta.appendChild(name); meta.appendChild(small);
        left.appendChild(meta);
        const right = document.createElement('div'); right.className='task-actions';
        const cbtn = document.createElement('button'); cbtn.className='btn-complete'; cbtn.textContent = t.completed ? 'Undo' : 'Complete';
        cbtn.addEventListener('click', ()=>{ toggleComplete(t.id); openDayModal(dateISO); });
        const del = document.createElement('button'); del.className='btn-delete'; del.textContent='Delete';
        del.addEventListener('click', ()=>{ if(confirm('Delete?')){ deleteTask(t.id); openDayModal(dateISO); }});
        right.appendChild(cbtn); right.appendChild(del);
        row.appendChild(left); row.appendChild(right);
        modalTasks.appendChild(row);
      });
    }
  }

  closeModal.addEventListener('click', ()=>{ dayModal.classList.add('hidden'); dayModal.setAttribute('aria-hidden','true') });

  /* ---------- Progress ---------- */
  function renderProgress(){
    const total = tasks.length;
    if(total===0){ miniProgressFill.style.width='0%'; miniProgressText.textContent='0%'; return; }
    const done = tasks.filter(t=>t.completed).length;
    const pct = Math.round((done/total)*100);
    miniProgressFill.style.width = pct + '%';
    miniProgressText.textContent = pct + '%';
  }

  /* ---------- Notifications (tiny toast) ---------- */
  function showToast(msg, timeout=1400){
    const el = document.createElement('div'); el.textContent = msg;
    el.style.position='fixed'; el.style.right='20px'; el.style.bottom='24px';
    el.style.background='linear-gradient(90deg,#ff9bd2,#d69bff)'; el.style.color='white';
    el.style.padding='10px 14px'; el.style.borderRadius='10px'; el.style.boxShadow='0 8px 24px rgba(0,0,0,0.18)';
    document.body.appendChild(el);
    setTimeout(()=> el.style.opacity = '0', timeout-200);
    setTimeout(()=> document.body.removeChild(el), timeout);
  }

  /* ---------- Event wiring ---------- */
  taskForm.addEventListener('submit', (e)=>{
    e.preventDefault();
    const name = taskName.value.trim(); const category = taskCategory.value; const date = taskDate.value; const priority = taskPriority.value;
    if(!name || !category || !date || !priority) { alert('Please fill all task fields'); return; }
    addTask({ id: uid(), name, category, date, priority, completed:false });
    taskForm.reset();
    showToast('Task added');
  });

  clearFormBtn.addEventListener('click', ()=> taskForm.reset());

  filterCategory.addEventListener('change', ()=>{ filters.category = filterCategory.value; applyFilters(); });
  filterPriority.addEventListener('change', ()=>{ filters.priority = filterPriority.value; applyFilters(); });
  filterStatus.addEventListener('change', ()=>{ filters.status = filterStatus.value; applyFilters(); });
  searchInput.addEventListener('input', ()=>{ filters.search = searchInput.value; applyFilters(); });

  prevMonth.addEventListener('click', ()=>{ currentDate.setMonth(currentDate.getMonth()-1); renderCalendar(); });
  nextMonth.addEventListener('click', ()=>{ currentDate.setMonth(currentDate.getMonth()+1); renderCalendar(); });

  /* ---------- Filter & render orchestration ---------- */
  function applyFilters(){ renderTasksList(); renderCalendar(); }

  function renderAll(){ renderTasksList(); renderCalendar(); renderProgress(); }

  /* ---------- Drag & Drop outer: allow dropping back to blank area to cancel ---------- */
  document.addEventListener('dragover', (e)=> e.preventDefault());
  document.addEventListener('drop', (e)=> e.preventDefault());

  /* ---------- Initial render ---------- */
  renderAll();

  /* ---------- helper: renderTasksList initial implementation ---------- */
  function renderTasksList(){
    // update mini filters object for local use
    const cat = filterCategory.value || 'All';
    const pri = filterPriority.value || 'All';
    const stat = filterStatus.value || 'All';
    const q = (searchInput.value||'').toLowerCase();

    // build filtered list
    let list = tasks.filter(t=>{
      if(cat!=='All' && t.category !== cat) return false;
      if(pri!=='All' && t.priority !== pri) return false;
      if(stat!=='All'){ if(stat==='Completed' && !t.completed) return false; if(stat==='Pending' && t.completed) return false; }
      if(q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });

    list.sort((a,b)=>{
      if(a.date === b.date) return priorityOrder(b.priority) - priorityOrder(a.priority);
      return a.date.localeCompare(b.date);
    });

    tasksContainer.innerHTML = '';
    list.forEach(t=>{
      const card = document.createElement('div'); card.className = 'task-card';
      card.draggable = true; card.dataset.id = t.id;

      card.addEventListener('dragstart', ()=> { dragTaskId = t.id; card.style.opacity='0.6' });
      card.addEventListener('dragend', ()=> { dragTaskId = null; card.style.opacity='1' });

      const left = document.createElement('div'); left.className = 'task-left';
      const meta = document.createElement('div'); meta.className = 'task-meta';
      const title = document.createElement('strong'); title.textContent = t.name;
      const small = document.createElement('small'); small.textContent = `${t.category} • ${t.date}`;
      meta.appendChild(title); meta.appendChild(small);
      left.appendChild(meta);

      const tag = document.createElement('span'); tag.className = 'tag ' + priorityClass(t.priority);
      tag.textContent = t.priority;

      const right = document.createElement('div'); right.className = 'task-actions';
      const btnComplete = document.createElement('button'); btnComplete.className = 'btn-complete'; btnComplete.textContent = t.completed ? 'Undo' : 'Complete';
      btnComplete.addEventListener('click', ()=> toggleComplete(t.id));
      const btnEdit = document.createElement('button'); btnEdit.className = 'btn-edit'; btnEdit.textContent = 'Edit';
      btnEdit.addEventListener('click', ()=> openEditPrompt(t.id));
      const btnDelete = document.createElement('button'); btnDelete.className = 'btn-delete'; btnDelete.textContent = 'Delete';
      btnDelete.addEventListener('click', ()=> { if(confirm('Delete task?')) deleteTask(t.id) });

      right.appendChild(tag); right.appendChild(btnComplete); right.appendChild(btnEdit); right.appendChild(btnDelete);

      card.appendChild(left); card.appendChild(right);
      tasksContainer.appendChild(card);
    });

    // show count
    document.getElementById('taskCount') && (document.getElementById('taskCount').textContent = ` (${list.length})`);
  }

  // rerender helpers used across
  function renderCalendar(){ renderCalendarBase(); } // wrapper to avoid hoisting confusion
  function renderCalendarBase(){
    calendarGrid.innerHTML = '';
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    monthYear.textContent = currentDate.toLocaleString('default',{month:'long', year:'numeric'});
    for(let i=0;i<firstDay;i++){ calendarGrid.appendChild(document.createElement('div')); }
    for(let d=1; d<=daysInMonth; d++){
      const dateISO = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const cell = document.createElement('div'); cell.className='calendar-day';
      const dateNum = document.createElement('div'); dateNum.className='date-num'; dateNum.textContent = d; cell.appendChild(dateNum);

      const dayTasks = tasks.filter(t=>t.date === dateISO);
      if(dayTasks.length){
        const wrapper = document.createElement('div'); wrapper.className='task-dots';
        dayTasks.forEach(t=>{
          const dot = document.createElement('span'); dot.className='task-dot'; dot.style.background = categoryColor(t.category);
          dot.title = `${t.name} (${t.priority})`;
          wrapper.appendChild(dot);
        });
        cell.appendChild(wrapper);
      }

      const todayISO = formatDateISO(new Date());
      if(dateISO === todayISO) cell.classList.add('today');

      cell.addEventListener('click', ()=> openDayModal(dateISO));

      // drag/drop
      cell.addEventListener('dragover', (e)=>{ e.preventDefault(); cell.style.transform='translateY(-6px)'; });
      cell.addEventListener('dragleave', ()=>{ cell.style.transform=''; });
      cell.addEventListener('drop', (e)=>{ e.preventDefault(); cell.style.transform=''; if(dragTaskId){ const t = tasks.find(x=>x.id===dragTaskId); if(t){ t.date = dateISO; save(); renderAll(); showToast(`Moved "${t.name}" to ${dateISO}`); } dragTaskId = null; } });

      calendarGrid.appendChild(cell);
    }
  }

  // initial applyFilters + state restore
  function applyFilters(){ renderTasksList(); renderCalendar(); renderProgress(); }
  function renderProgress(){ renderProgressBase(); }
  function renderProgressBase(){
    const total = tasks.length;
    if(total===0){ miniProgressFill.style.width='0%'; miniProgressText.textContent='0%'; return; }
    const done = tasks.filter(t=>t.completed).length;
    const pct = Math.round((done/total)*100);
    miniProgressFill.style.width = pct + '%'; miniProgressText.textContent = pct + '%';
  }

  // start UI
  applyFilters();
})();
