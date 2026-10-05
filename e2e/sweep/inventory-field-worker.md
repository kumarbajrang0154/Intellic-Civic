# UI Inventory: FIELD-WORKER

Total controls enumerated directly from source code.

## src\app\field-worker\complaints\[id]\page.tsx (9 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L257 | Link | <Link href="/field-worker"> | Action executes with valid state update / navigation |
| L258 | Button | <Button variant="outline" size="sm"> | Action executes with valid state update / navigation |
| L279 | Link | <Link href="/field-worker"> | Action executes with valid state update / navigation |
| L280 | Button | <Button variant="ghost" size="icon" aria-label="Back to Task Queue"> | Action executes with valid state update / navigation |
| L313 | Button | <Button | Action executes with valid state update / navigation |
| L314 | Clickable | onClick={handleStartWork} | Action executes with valid state update / navigation |
| L446 | Form | <form onSubmit={handleSubmitForReview} className="space-y-4 pt-4 border-t"> | Action executes with valid state update / navigation |
| L458 | Input/Filter | <Textarea | Action executes with valid state update / navigation |
| L500 | Button | <Button | Action executes with valid state update / navigation |

## src\app\field-worker\page.tsx (5 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L225 | Button | <Button | Action executes with valid state update / navigation |
| L229 | Clickable | onClick={() => setStatusTab(tab.id as any)} | Action executes with valid state update / navigation |
| L251 | Button | <Button variant="outline" size="sm" onClick={() => fetchData()} className="mt-4 border-rose-200"> | Action executes with valid state update / navigation |
| L310 | Link | <Link href={`/field-worker/complaints/${complaint.id}`}> | Action executes with valid state update / navigation |
| L311 | Button | <Button size="sm" className="h-8 text-xs font-semibold gap-1 bg-ic-blue hover:bg-blue-700 text-white | Action executes with valid state update / navigation |

## src\app\field-worker\profile\page.tsx (6 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L174 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L181 | Input/Filter | <input | Action executes with valid state update / navigation |
| L188 | Button | <Button | Action executes with valid state update / navigation |
| L193 | Clickable | onClick={() => fileInputRef.current?.click()} | Action executes with valid state update / navigation |
| L209 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L246 | Button | <Button onClick={handleSaveProfile} disabled={saving} className="gap-2"> | Action executes with valid state update / navigation |

