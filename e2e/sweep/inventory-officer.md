# UI Inventory: OFFICER

Total controls enumerated directly from source code.

## src\app\officer\complaints\page.tsx (9 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L171 | Button | <Button | Action executes with valid state update / navigation |
| L175 | Clickable | onClick={() => setViewMode('table')} | Action executes with valid state update / navigation |
| L180 | Button | <Button | Action executes with valid state update / navigation |
| L184 | Clickable | onClick={() => setViewMode('map')} | Action executes with valid state update / navigation |
| L205 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L215 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L227 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L317 | Link | <Link href={`/officer/complaints/${item.id}`}> | Action executes with valid state update / navigation |
| L318 | Button | <Button size="sm" className="text-xs flex items-center gap-1.5"> | Action executes with valid state update / navigation |

## src\app\officer\complaints\[id]\page.tsx (16 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L330 | Link | <Link href="/officer/complaints" className="text-xs text-primary flex items-center gap-1"> | Action executes with valid state update / navigation |
| L377 | Button | <Button | Action executes with valid state update / navigation |
| L380 | Clickable | onClick={async () => { | Action executes with valid state update / navigation |
| L444 | Button | <Button | Action executes with valid state update / navigation |
| L446 | Clickable | onClick={async () => { | Action executes with valid state update / navigation |
| L520 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L533 | Button | <Button | Action executes with valid state update / navigation |
| L535 | Clickable | onClick={handleAssignFieldWorker} | Action executes with valid state update / navigation |
| L575 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L593 | Input/Filter | <Textarea | Action executes with valid state update / navigation |
| L602 | Button | <Button | Action executes with valid state update / navigation |
| L604 | Clickable | onClick={handleUpdateStatus} | Action executes with valid state update / navigation |
| L638 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L650 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L666 | Button | <Button | Action executes with valid state update / navigation |
| L668 | Clickable | onClick={handleUploadWorkEvidence} | Action executes with valid state update / navigation |

## src\app\officer\page.tsx (5 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L149 | Link | <Link href="/officer/complaints"> | Action executes with valid state update / navigation |
| L150 | Button | <Button size="sm" className="bg-ic-blue hover:bg-blue-700 text-white flex items-center gap-1.5 text- | Action executes with valid state update / navigation |
| L229 | Link | <Link href="/officer/complaints" className="text-xs text-ic-blue font-semibold hover:underline"> | Action executes with valid state update / navigation |
| L279 | Link | <Link href={`/officer/complaints/${item.id}`}> | Action executes with valid state update / navigation |
| L280 | Button | <Button size="sm" variant="outline" className="text-xs flex items-center gap-1 border-slate-200"> | Action executes with valid state update / navigation |

## src\app\officer\profile\page.tsx (6 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L174 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L181 | Input/Filter | <input | Action executes with valid state update / navigation |
| L188 | Button | <Button | Action executes with valid state update / navigation |
| L193 | Clickable | onClick={() => fileInputRef.current?.click()} | Action executes with valid state update / navigation |
| L209 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L246 | Button | <Button onClick={handleSaveProfile} disabled={saving} className="gap-2"> | Action executes with valid state update / navigation |

