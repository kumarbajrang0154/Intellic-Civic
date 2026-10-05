# UI Inventory: ADMIN

Total controls enumerated directly from source code.

## src\app\admin\ai\classification\page.tsx (6 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L27 | Link | <Link href="/admin/categories"> | Action executes with valid state update / navigation |
| L28 | Button | <Button className="bg-ic-action hover:bg-ic-blue text-white border-0" size="sm"> | Action executes with valid state update / navigation |
| L51 | Link | <Link href="/admin/categories"> | Action executes with valid state update / navigation |
| L52 | Button | <Button variant="outline" size="sm"> | Action executes with valid state update / navigation |
| L57 | Link | <Link href="/admin/ai/performance"> | Action executes with valid state update / navigation |
| L58 | Button | <Button variant="outline" size="sm">View AI Performance →</Button> | Action executes with valid state update / navigation |

## src\app\admin\ai\logs\page.tsx (1 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L96 | Input/Filter | <Input | Action executes with valid state update / navigation |

## src\app\admin\analytics\page.tsx (2 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L138 | Button | <Button | Action executes with valid state update / navigation |
| L141 | Clickable | onClick={() => { | Action executes with valid state update / navigation |

## src\app\admin\categories\page.tsx (9 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L146 | Button | <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}> | Action executes with valid state update / navigation |
| L150 | Button | <Button className="bg-purple-600 hover:bg-purple-700 text-white" onClick={openCreateModal}> | Action executes with valid state update / navigation |
| L171 | Button | <Button variant="ghost" size="sm" onClick={() => openEditModal(cat)}> | Action executes with valid state update / navigation |
| L212 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L222 | Input/Filter | <textarea | Action executes with valid state update / navigation |
| L233 | Input/Filter | <Select value={deptIdInput} onChange={(e) => setDeptIdInput(e.target.value)}> | Action executes with valid state update / navigation |
| L244 | Button | <Button variant="outline" onClick={() => setIsModalOpen(false)}> | Action executes with valid state update / navigation |
| L247 | Button | <Button | Action executes with valid state update / navigation |
| L249 | Clickable | onClick={handleSubmit} | Action executes with valid state update / navigation |

## src\app\admin\complaints\page.tsx (8 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L119 | Button | <Button variant="outline" size="sm" onClick={fetchComplaints} disabled={loading}> | Action executes with valid state update / navigation |
| L132 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L143 | Input/Filter | <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}> | Action executes with valid state update / navigation |
| L155 | Input/Filter | <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}> | Action executes with valid state update / navigation |
| L169 | Input/Filter | <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}> | Action executes with valid state update / navigation |
| L180 | Input/Filter | <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}> | Action executes with valid state update / navigation |
| L237 | Link | <Link href={`/admin/complaints/${c.id}`}> | Action executes with valid state update / navigation |
| L238 | Button | <Button variant="ghost" size="sm"> | Action executes with valid state update / navigation |

## src\app\admin\complaints\[id]\page.tsx (7 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L173 | Link | <Link href="/admin/complaints"> | Action executes with valid state update / navigation |
| L174 | Button | <Button variant="outline">Back to All Complaints</Button> | Action executes with valid state update / navigation |
| L203 | Link | <Link href="/admin/complaints"> | Action executes with valid state update / navigation |
| L204 | Button | <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900"> | Action executes with valid state update / navigation |
| L385 | Input/Filter | <Select value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)}> | Action executes with valid state update / navigation |
| L395 | Button | <Button | Action executes with valid state update / navigation |
| L398 | Clickable | onClick={handleReassignDepartment} | Action executes with valid state update / navigation |

## src\app\admin\departments\heads\page.tsx (4 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L60 | Link | <Link href="/admin/staff"> | Action executes with valid state update / navigation |
| L61 | Button | <Button size="sm">Manage All Staff</Button> | Action executes with valid state update / navigation |
| L125 | Link | <Link href={`/admin/staff/${s.id}/activity`}> | Action executes with valid state update / navigation |
| L126 | Button | <Button variant="outline" size="sm" className="text-xs h-7"> | Action executes with valid state update / navigation |

## src\app\admin\departments\officers\page.tsx (4 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L59 | Link | <Link href="/admin/staff"> | Action executes with valid state update / navigation |
| L60 | Button | <Button size="sm">Manage All Staff</Button> | Action executes with valid state update / navigation |
| L118 | Link | <Link href={`/admin/staff/${s.id}/activity`}> | Action executes with valid state update / navigation |
| L119 | Button | <Button variant="outline" size="sm" className="text-xs h-7"> | Action executes with valid state update / navigation |

## src\app\admin\departments\page.tsx (15 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L167 | Button | <Button variant="outline" size="sm" onClick={fetchDepartments} disabled={loading}> | Action executes with valid state update / navigation |
| L171 | Button | <Button className="bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white hover:opacity-95 shadow-s | Action executes with valid state update / navigation |
| L205 | Button | <Button variant="ghost" size="sm" title="Edit Department" onClick={() => openEditModal(dept)}> | Action executes with valid state update / navigation |
| L208 | Button | <Button | Action executes with valid state update / navigation |
| L212 | Clickable | onClick={() => handleToggleSuspend(dept)} | Action executes with valid state update / navigation |
| L216 | Button | <Button variant="ghost" size="sm" title="Remove Department" onClick={() => setDeletingDept(dept)}> | Action executes with valid state update / navigation |
| L273 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L284 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L295 | Input/Filter | <textarea | Action executes with valid state update / navigation |
| L305 | Button | <Button variant="outline" onClick={() => setIsModalOpen(false)}> | Action executes with valid state update / navigation |
| L308 | Button | <Button | Action executes with valid state update / navigation |
| L310 | Clickable | onClick={handleSubmit} | Action executes with valid state update / navigation |
| L330 | Button | <Button variant="outline" onClick={() => setDeletingDept(null)}> | Action executes with valid state update / navigation |
| L333 | Button | <Button | Action executes with valid state update / navigation |
| L335 | Clickable | onClick={handleDeleteConfirm} | Action executes with valid state update / navigation |

## src\app\admin\notifications\page.tsx (7 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L128 | Button | <Button variant="outline" size="sm" onClick={markAllRead}> | Action executes with valid state update / navigation |
| L145 | Button | <button | Action executes with valid state update / navigation |
| L147 | Clickable | onClick={() => setFilter(tab.key)} | Action executes with valid state update / navigation |
| L206 | Button | <button | Action executes with valid state update / navigation |
| L207 | Clickable | onClick={() => markRead(item.id)} | Action executes with valid state update / navigation |
| L213 | Link | <Link href={`/admin/complaints/${item.id}`}> | Action executes with valid state update / navigation |
| L214 | Button | <Button variant="outline" size="sm" className="text-xs h-7"> | Action executes with valid state update / navigation |

## src\app\admin\page.tsx (6 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L191 | Link | <Link href="/admin/complaints/pending"> | Action executes with valid state update / navigation |
| L192 | Button | <Button | Action executes with valid state update / navigation |
| L200 | Link | <Link href="/admin/staff"> | Action executes with valid state update / navigation |
| L201 | Button | <Button variant="outline" size="sm"> | Action executes with valid state update / navigation |
| L370 | Link | <Link href="/admin/complaints"> | Action executes with valid state update / navigation |
| L371 | Button | <Button variant="outline" size="sm" className="text-xs"> | Action executes with valid state update / navigation |

## src\app\admin\profile\page.tsx (6 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L168 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L175 | Input/Filter | <input | Action executes with valid state update / navigation |
| L182 | Button | <Button | Action executes with valid state update / navigation |
| L187 | Clickable | onClick={() => fileInputRef.current?.click()} | Action executes with valid state update / navigation |
| L203 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L231 | Button | <Button onClick={handleSaveProfile} disabled={saving} className="gap-2"> | Action executes with valid state update / navigation |

## src\app\admin\security\page.tsx (4 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L139 | Button | <button | Action executes with valid state update / navigation |
| L141 | Clickable | onClick={() => setActiveTab(tab)} | Action executes with valid state update / navigation |
| L254 | Link | <Link href={`/admin/staff/${s.id}/activity`}> | Action executes with valid state update / navigation |
| L255 | Button | <Button variant="outline" size="sm" className="text-xs h-7"> | Action executes with valid state update / navigation |

## src\app\admin\settings\page.tsx (42 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L298 | Button | <Button onClick={() => (window.location.href = '/admin')}> | Action executes with valid state update / navigation |
| L326 | Button | <Button | Action executes with valid state update / navigation |
| L329 | Clickable | onClick={handleReset} | Action executes with valid state update / navigation |
| L336 | Button | <Button | Action executes with valid state update / navigation |
| L338 | Clickable | onClick={handleSave} | Action executes with valid state update / navigation |
| L373 | Button | <button | Action executes with valid state update / navigation |
| L376 | Clickable | onClick={() => setActiveTab(tab.id)} | Action executes with valid state update / navigation |
| L427 | Form | <form onSubmit={handleSave}> | Action executes with valid state update / navigation |
| L443 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L453 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L464 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L474 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L484 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L510 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L521 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L532 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L541 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L551 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L575 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L584 | Input/Filter | <textarea | Action executes with valid state update / navigation |
| L595 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L604 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L613 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L624 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L633 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L658 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L668 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L679 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L726 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L736 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L745 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L756 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L765 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L775 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L799 | Input/Filter | <textarea | Action executes with valid state update / navigation |
| L809 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L833 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L842 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L866 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L875 | Input/Filter | <textarea | Action executes with valid state update / navigation |
| L885 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L894 | Input/Filter | <Input | Action executes with valid state update / navigation |

## src\app\admin\staff\page.tsx (32 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L345 | Link | <Link href="/admin/staff/workload"> | Action executes with valid state update / navigation |
| L346 | Button | <Button variant="outline" size="sm"> | Action executes with valid state update / navigation |
| L350 | Button | <Button variant="outline" size="sm" onClick={fetchStaff} disabled={loading}> | Action executes with valid state update / navigation |
| L353 | Button | <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreate}> | Action executes with valid state update / navigation |
| L365 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L372 | Input/Filter | <select | Action executes with valid state update / navigation |
| L379 | Input/Filter | <select | Action executes with valid state update / navigation |
| L387 | Input/Filter | <select | Action executes with valid state update / navigation |
| L458 | Link | <Link href={`/admin/staff/${staff.id}/activity`}> | Action executes with valid state update / navigation |
| L459 | Button | <Button variant="ghost" size="sm" title="View Activity"> | Action executes with valid state update / navigation |
| L465 | Button | <Button variant="ghost" size="sm" title="Reassign" onClick={() => openReassign(staff)}> | Action executes with valid state update / navigation |
| L469 | Button | <Button variant="ghost" size="sm" title="Deactivate" onClick={() => setDeactivateTarget(staff)}> | Action executes with valid state update / navigation |
| L473 | Button | <Button variant="ghost" size="sm" title="Reactivate" onClick={() => handleReactivate(staff)}> | Action executes with valid state update / navigation |
| L478 | Button | <Button | Action executes with valid state update / navigation |
| L482 | Clickable | onClick={() => setDeleteTarget(staff)} | Action executes with valid state update / navigation |
| L508 | Button | <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}> | Action executes with valid state update / navigation |
| L512 | Button | <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p | Action executes with valid state update / navigation |
| L535 | Input/Filter | <Input placeholder="e.g. Amit Sharma" value={createName} onChange={(e) => setCreateName(e.target.val | Action executes with valid state update / navigation |
| L539 | Input/Filter | <Input type="email" placeholder="e.g. amit.sharma@smartcity.gov.in" value={createEmail} onChange={(e | Action executes with valid state update / navigation |
| L543 | Input/Filter | <select | Action executes with valid state update / navigation |
| L556 | Input/Filter | <select | Action executes with valid state update / navigation |
| L569 | Input/Filter | <select | Action executes with valid state update / navigation |
| L594 | Button | <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button> | Action executes with valid state update / navigation |
| L595 | Button | <Button className="bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white hover:opacity-95 shadow-s | Action executes with valid state update / navigation |
| L613 | Button | <Button variant="outline" onClick={() => setDeactivateTarget(null)}>Cancel</Button> | Action executes with valid state update / navigation |
| L614 | Button | <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleDeactivate} disabled={de | Action executes with valid state update / navigation |
| L633 | Button | <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button> | Action executes with valid state update / navigation |
| L634 | Button | <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleDelete} disabled={deleti | Action executes with valid state update / navigation |
| L658 | Input/Filter | <select | Action executes with valid state update / navigation |
| L671 | Input/Filter | <select | Action executes with valid state update / navigation |
| L683 | Button | <Button variant="outline" onClick={() => setReassignTarget(null)}>Cancel</Button> | Action executes with valid state update / navigation |
| L684 | Button | <Button className="bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white hover:opacity-95 shadow-s | Action executes with valid state update / navigation |

## src\app\admin\staff\workload\page.tsx (5 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L71 | Link | <Link href="/admin/staff"> | Action executes with valid state update / navigation |
| L72 | Button | <Button variant="outline" size="sm"> | Action executes with valid state update / navigation |
| L85 | Button | <Button variant="outline" size="sm" onClick={fetchWorkload} disabled={loading}> | Action executes with valid state update / navigation |
| L197 | Link | <Link href={`/admin/staff?departmentId=${dept.departmentId}`}> | Action executes with valid state update / navigation |
| L198 | Button | <Button variant="outline" size="sm" className="w-full text-xs"> | Action executes with valid state update / navigation |

## src\app\admin\staff\[id]\activity\page.tsx (3 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L113 | Link | <Link href="/admin/staff"> | Action executes with valid state update / navigation |
| L114 | Button | <Button variant="outline" size="sm"> | Action executes with valid state update / navigation |
| L129 | Button | <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}> | Action executes with valid state update / navigation |

## src\app\admin\system\page.tsx (7 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L135 | Button | <button | Action executes with valid state update / navigation |
| L137 | Clickable | onClick={() => setActiveTab(tab.key)} | Action executes with valid state update / navigation |
| L162 | Button | <Button | Action executes with valid state update / navigation |
| L164 | Clickable | onClick={saveSla} | Action executes with valid state update / navigation |
| L197 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L236 | Link | <Link href="/admin/categories"> | Action executes with valid state update / navigation |
| L237 | Button | <Button size="sm" variant="outline"> | Action executes with valid state update / navigation |

## src\app\admin\triage\page.tsx (5 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L109 | Button | <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}> | Action executes with valid state update / navigation |
| L147 | Link | <Link href={`/admin/complaints/${c.id}`}> | Action executes with valid state update / navigation |
| L182 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L196 | Button | <Button | Action executes with valid state update / navigation |
| L199 | Clickable | onClick={() => handleManualAssign(c.id)} | Action executes with valid state update / navigation |

## src\app\admin\users\citizens\page.tsx (32 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L253 | Button | <button | Action executes with valid state update / navigation |
| L254 | Clickable | onClick={() => setActionNotice(null)} | Action executes with valid state update / navigation |
| L267 | Button | <button | Action executes with valid state update / navigation |
| L269 | Clickable | onClick={() => setStatusFilter(tab)} | Action executes with valid state update / navigation |
| L285 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L293 | Button | <Button | Action executes with valid state update / navigation |
| L297 | Clickable | onClick={() => fetchCitizens(pagination.page)} | Action executes with valid state update / navigation |
| L422 | Link | <Link href={`/admin/users/citizens/${c.id}`}> | Action executes with valid state update / navigation |
| L423 | Button | <Button | Action executes with valid state update / navigation |
| L437 | Button | <Button | Action executes with valid state update / navigation |
| L441 | Clickable | onClick={() => { | Action executes with valid state update / navigation |
| L451 | Button | <Button | Action executes with valid state update / navigation |
| L455 | Clickable | onClick={() => { | Action executes with valid state update / navigation |
| L469 | Button | <Button | Action executes with valid state update / navigation |
| L473 | Clickable | onClick={() => { | Action executes with valid state update / navigation |
| L504 | Button | <Button | Action executes with valid state update / navigation |
| L509 | Clickable | onClick={() => handlePageChange(pagination.page - 1)} | Action executes with valid state update / navigation |
| L519 | Button | <Button | Action executes with valid state update / navigation |
| L524 | Clickable | onClick={() => handlePageChange(pagination.page + 1)} | Action executes with valid state update / navigation |
| L557 | Input/Filter | <textarea | Action executes with valid state update / navigation |
| L567 | Button | <Button | Action executes with valid state update / navigation |
| L572 | Clickable | onClick={() => { | Action executes with valid state update / navigation |
| L579 | Button | <Button | Action executes with valid state update / navigation |
| L583 | Clickable | onClick={handleSuspendConfirm} | Action executes with valid state update / navigation |
| L611 | Button | <Button | Action executes with valid state update / navigation |
| L616 | Clickable | onClick={() => { | Action executes with valid state update / navigation |
| L623 | Button | <Button | Action executes with valid state update / navigation |
| L627 | Clickable | onClick={handleActivateConfirm} | Action executes with valid state update / navigation |
| L661 | Button | <Button | Action executes with valid state update / navigation |
| L666 | Clickable | onClick={() => { | Action executes with valid state update / navigation |
| L673 | Button | <Button | Action executes with valid state update / navigation |
| L677 | Clickable | onClick={handleDeleteConfirm} | Action executes with valid state update / navigation |

## src\app\admin\users\citizens\[id]\page.tsx (21 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L267 | Button | <button | Action executes with valid state update / navigation |
| L268 | Clickable | onClick={() => setNotice(null)} | Action executes with valid state update / navigation |
| L312 | Button | <Button | Action executes with valid state update / navigation |
| L316 | Clickable | onClick={() => setActiveModal('activate')} | Action executes with valid state update / navigation |
| L322 | Button | <Button | Action executes with valid state update / navigation |
| L326 | Clickable | onClick={() => setActiveModal('suspend')} | Action executes with valid state update / navigation |
| L335 | Button | <Button | Action executes with valid state update / navigation |
| L339 | Clickable | onClick={() => setActiveModal('delete')} | Action executes with valid state update / navigation |
| L557 | Input/Filter | <textarea | Action executes with valid state update / navigation |
| L567 | Button | <Button | Action executes with valid state update / navigation |
| L572 | Clickable | onClick={() => setActiveModal(null)} | Action executes with valid state update / navigation |
| L576 | Button | <Button | Action executes with valid state update / navigation |
| L580 | Clickable | onClick={handleSuspendConfirm} | Action executes with valid state update / navigation |
| L608 | Button | <Button | Action executes with valid state update / navigation |
| L613 | Clickable | onClick={() => setActiveModal(null)} | Action executes with valid state update / navigation |
| L617 | Button | <Button | Action executes with valid state update / navigation |
| L621 | Clickable | onClick={handleActivateConfirm} | Action executes with valid state update / navigation |
| L649 | Button | <Button | Action executes with valid state update / navigation |
| L654 | Clickable | onClick={() => setActiveModal(null)} | Action executes with valid state update / navigation |
| L658 | Button | <Button | Action executes with valid state update / navigation |
| L662 | Clickable | onClick={handleDeleteConfirm} | Action executes with valid state update / navigation |

## src\app\admin\users\page.tsx (28 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L226 | Button | <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}> | Action executes with valid state update / navigation |
| L230 | Button | <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openAddModal}> | Action executes with valid state update / navigation |
| L245 | Input/Filter | <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}> | Action executes with valid state update / navigation |
| L258 | Input/Filter | <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}> | Action executes with valid state update / navigation |
| L273 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L339 | Button | <Button | Action executes with valid state update / navigation |
| L343 | Clickable | onClick={() => openEditModal(u)} | Action executes with valid state update / navigation |
| L350 | Button | <Button | Action executes with valid state update / navigation |
| L354 | Clickable | onClick={() => handleToggleSuspend(u)} | Action executes with valid state update / navigation |
| L358 | Button | <Button | Action executes with valid state update / navigation |
| L362 | Clickable | onClick={() => setDeleteUserItem(u)} | Action executes with valid state update / navigation |
| L397 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L408 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L420 | Input/Filter | <Select value={newRole} onChange={(e) => setNewRole(e.target.value)}> | Action executes with valid state update / navigation |
| L433 | Input/Filter | <Select value={newDeptId} onChange={(e) => setNewDeptId(e.target.value)}> | Action executes with valid state update / navigation |
| L445 | Button | <Button variant="outline" onClick={() => setIsAddModalOpen(false)}> | Action executes with valid state update / navigation |
| L448 | Button | <Button | Action executes with valid state update / navigation |
| L450 | Clickable | onClick={handleAddOfficer} | Action executes with valid state update / navigation |
| L474 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L484 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L494 | Input/Filter | <Select value={editRole} onChange={(e) => setEditRole(e.target.value)}> | Action executes with valid state update / navigation |
| L507 | Input/Filter | <Select value={editDeptId} onChange={(e) => setEditDeptId(e.target.value)}> | Action executes with valid state update / navigation |
| L519 | Button | <Button variant="outline" onClick={() => setEditUser(null)}> | Action executes with valid state update / navigation |
| L522 | Button | <Button | Action executes with valid state update / navigation |
| L524 | Clickable | onClick={handleSaveEdit} | Action executes with valid state update / navigation |
| L544 | Button | <Button variant="outline" onClick={() => setDeleteUserItem(null)}> | Action executes with valid state update / navigation |
| L547 | Button | <Button | Action executes with valid state update / navigation |
| L549 | Clickable | onClick={handleDeleteConfirm} | Action executes with valid state update / navigation |

## src\app\admin\users\pending\page.tsx (10 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L123 | Button | <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}> | Action executes with valid state update / navigation |
| L158 | Button | <Button | Action executes with valid state update / navigation |
| L161 | Clickable | onClick={() => handleReject(u.id)} | Action executes with valid state update / navigation |
| L166 | Button | <Button | Action executes with valid state update / navigation |
| L168 | Clickable | onClick={() => setApproveUser(u)} | Action executes with valid state update / navigation |
| L195 | Input/Filter | <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}> | Action executes with valid state update / navigation |
| L207 | Input/Filter | <Select value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)}> | Action executes with valid state update / navigation |
| L219 | Button | <Button variant="outline" onClick={() => setApproveUser(null)}> | Action executes with valid state update / navigation |
| L222 | Button | <Button | Action executes with valid state update / navigation |
| L224 | Clickable | onClick={handleConfirmApprove} | Action executes with valid state update / navigation |

## src\app\(auth)\login\staff\page.tsx (2 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L58 | Link | <a href="/api/auth/google" className="block w-full"> | Action executes with valid state update / navigation |
| L59 | Button | <Button | Action executes with valid state update / navigation |

