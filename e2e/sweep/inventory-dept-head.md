# UI Inventory: DEPT-HEAD

Total controls enumerated directly from source code.

## src\app\dept-head\ai-suggestions\page.tsx (6 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L200 | Link | <Link href="/dept-head/complaints"> | Action executes with valid state update / navigation |
| L201 | Button | <Button size="sm" variant="outline" className="mt-2"> | Action executes with valid state update / navigation |
| L246 | Button | <Button | Action executes with valid state update / navigation |
| L250 | Clickable | onClick={() => handleRejectSuggestion(item.id)} | Action executes with valid state update / navigation |
| L256 | Button | <Button | Action executes with valid state update / navigation |
| L260 | Clickable | onClick={() => handleConfirmSuggestion(item.id)} | Action executes with valid state update / navigation |

## src\app\dept-head\complaints\page.tsx (13 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L186 | Button | <Button | Action executes with valid state update / navigation |
| L190 | Clickable | onClick={() => setViewMode('table')} | Action executes with valid state update / navigation |
| L195 | Button | <Button | Action executes with valid state update / navigation |
| L199 | Clickable | onClick={() => setViewMode('map')} | Action executes with valid state update / navigation |
| L217 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L226 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L244 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L260 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L314 | Clickable | onClick={() => router.push(`/department-head/complaints/${item.id}`)} | Action executes with valid state update / navigation |
| L359 | Button | <Button | Action executes with valid state update / navigation |
| L363 | Clickable | onClick={() => setPage((p) => Math.max(1, p - 1))} | Action executes with valid state update / navigation |
| L368 | Button | <Button | Action executes with valid state update / navigation |
| L372 | Clickable | onClick={() => setPage((p) => Math.min(totalPages, p + 1))} | Action executes with valid state update / navigation |

## src\app\dept-head\complaints\[id]\page.tsx (12 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L241 | Link | <Link href="/department-head/complaints"> | Action executes with valid state update / navigation |
| L242 | Button | <Button variant="outline" size="sm"> | Action executes with valid state update / navigation |
| L260 | Link | <Link href="/department-head/complaints"> | Action executes with valid state update / navigation |
| L261 | Button | <Button variant="ghost" size="icon" aria-label="Back to Queue"> | Action executes with valid state update / navigation |
| L458 | Form | <form onSubmit={handleUpdateStatus} className="space-y-3"> | Action executes with valid state update / navigation |
| L459 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L473 | Input/Filter | <Textarea | Action executes with valid state update / navigation |
| L481 | Button | <Button | Action executes with valid state update / navigation |
| L519 | Form | <form onSubmit={handleAssignOfficer} className="space-y-3"> | Action executes with valid state update / navigation |
| L520 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L534 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L541 | Button | <Button | Action executes with valid state update / navigation |

## src\app\dept-head\page.tsx (8 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L133 | Link | <Link href="/dept-head/ai-suggestions"> | Action executes with valid state update / navigation |
| L134 | Button | <Button variant="ai" size="sm" className="whitespace-nowrap flex items-center gap-2 shrink-0"> | Action executes with valid state update / navigation |
| L242 | Link | <Link href="/dept-head/complaints"> | Action executes with valid state update / navigation |
| L243 | Button | <Button className="w-full bg-ic-blue hover:bg-blue-700 text-white flex items-center justify-between" | Action executes with valid state update / navigation |
| L263 | Link | <Link href="/dept-head/ai-suggestions"> | Action executes with valid state update / navigation |
| L264 | Button | <Button variant="ai" className="w-full flex items-center justify-between"> | Action executes with valid state update / navigation |
| L282 | Link | <Link href="/dept-head/team"> | Action executes with valid state update / navigation |
| L283 | Button | <Button variant="outline" className="w-full border-slate-200 flex items-center justify-between"> | Action executes with valid state update / navigation |

## src\app\dept-head\profile\page.tsx (6 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L174 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L181 | Input/Filter | <input | Action executes with valid state update / navigation |
| L188 | Button | <Button | Action executes with valid state update / navigation |
| L193 | Clickable | onClick={() => fileInputRef.current?.click()} | Action executes with valid state update / navigation |
| L209 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L248 | Button | <Button onClick={handleSaveProfile} disabled={saving} className="gap-2"> | Action executes with valid state update / navigation |

