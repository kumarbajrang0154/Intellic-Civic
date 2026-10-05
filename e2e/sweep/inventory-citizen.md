# UI Inventory: CITIZEN

Total controls enumerated directly from source code.

## src\app\citizen\complaints\new\page.tsx (30 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L471 | Link | <Link href={`/citizen/complaints/${createdComplaintId}`} className="w-full"> | Action executes with valid state update / navigation |
| L472 | Button | <Button className="w-full bg-ic-blue hover:bg-blue-700 text-white font-medium">Track This Complaint< | Action executes with valid state update / navigation |
| L474 | Link | <Link href="/citizen" className="w-full"> | Action executes with valid state update / navigation |
| L475 | Button | <Button variant="outline" className="w-full border-slate-200"> | Action executes with valid state update / navigation |
| L491 | Link | <Link href="/citizen"> | Action executes with valid state update / navigation |
| L492 | Button | <Button variant="ghost" size="icon" aria-label="Back to Dashboard" className="text-slate-600"> | Action executes with valid state update / navigation |
| L534 | Link | <Link href={`/citizen/complaints/${dup.id}`} target="_blank"> | Action executes with valid state update / navigation |
| L535 | Button | <Button variant="outline" size="sm" className="text-xs gap-1 shrink-0 border-slate-200"> | Action executes with valid state update / navigation |
| L543 | Button | <Button | Action executes with valid state update / navigation |
| L547 | Clickable | onClick={() => setDuplicateWarning(null)} | Action executes with valid state update / navigation |
| L552 | Button | <Button | Action executes with valid state update / navigation |
| L555 | Clickable | onClick={() => { | Action executes with valid state update / navigation |
| L589 | Button | <Button | Action executes with valid state update / navigation |
| L593 | Clickable | onClick={() => startListening('full')} | Action executes with valid state update / navigation |
| L636 | Form | <form onSubmit={handleSubmit} className="space-y-6"> | Action executes with valid state update / navigation |
| L645 | Button | <Button | Action executes with valid state update / navigation |
| L649 | Clickable | onClick={() => startListening('title')} | Action executes with valid state update / navigation |
| L667 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L683 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L709 | Button | <Button | Action executes with valid state update / navigation |
| L713 | Clickable | onClick={() => startListening('description')} | Action executes with valid state update / navigation |
| L731 | Input/Filter | <Textarea | Action executes with valid state update / navigation |
| L754 | Button | <Button | Action executes with valid state update / navigation |
| L758 | Clickable | onClick={() => startListening('address')} | Action executes with valid state update / navigation |
| L766 | Button | <Button | Action executes with valid state update / navigation |
| L770 | Clickable | onClick={handleGetCurrentLocation} | Action executes with valid state update / navigation |
| L789 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L840 | Link | <Link href="/citizen"> | Action executes with valid state update / navigation |
| L841 | Button | <Button variant="outline" type="button" disabled={isSubmitting \|\| checkingDuplicates} className="b | Action executes with valid state update / navigation |
| L845 | Button | <Button type="submit" disabled={isSubmitting \|\| checkingDuplicates} className="min-w-[140px] bg-ic | Action executes with valid state update / navigation |

## src\app\citizen\complaints\[id]\page.tsx (21 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L296 | Link | <Link href="/citizen"> | Action executes with valid state update / navigation |
| L297 | Button | <Button className="w-full">Return to Dashboard</Button> | Action executes with valid state update / navigation |
| L314 | Link | <Link href="/citizen"> | Action executes with valid state update / navigation |
| L315 | Button | <Button variant="outline" size="sm"> | Action executes with valid state update / navigation |
| L348 | Link | <Link href="/citizen"> | Action executes with valid state update / navigation |
| L349 | Button | <Button variant="ghost" size="icon" aria-label="Back to Dashboard"> | Action executes with valid state update / navigation |
| L373 | Button | <Button | Action executes with valid state update / navigation |
| L377 | Clickable | onClick={handleDeleteComplaint} | Action executes with valid state update / navigation |
| L439 | Button | <Button | Action executes with valid state update / navigation |
| L440 | Clickable | onClick={handleMarkSatisfactory} | Action executes with valid state update / navigation |
| L447 | Button | <Button | Action executes with valid state update / navigation |
| L449 | Clickable | onClick={() => setReopenModalOpen(true)} | Action executes with valid state update / navigation |
| L498 | Form | <form onSubmit={handleSubmitFeedback} className="space-y-3 text-xs"> | Action executes with valid state update / navigation |
| L508 | Button | <button | Action executes with valid state update / navigation |
| L511 | Clickable | onClick={() => setFeedbackRating(star)} | Action executes with valid state update / navigation |
| L531 | Input/Filter | <Textarea | Action executes with valid state update / navigation |
| L541 | Button | <Button | Action executes with valid state update / navigation |
| L748 | Input/Filter | <Textarea | Action executes with valid state update / navigation |
| L759 | Button | <Button variant="outline" onClick={() => setReopenModalOpen(false)}> | Action executes with valid state update / navigation |
| L762 | Button | <Button | Action executes with valid state update / navigation |
| L763 | Clickable | onClick={handleReopenComplaint} | Action executes with valid state update / navigation |

## src\app\citizen\notifications\page.tsx (6 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L132 | Button | <Button | Action executes with valid state update / navigation |
| L135 | Clickable | onClick={handleMarkAllAsRead} | Action executes with valid state update / navigation |
| L168 | Link | <Link href="/citizen" className="inline-block"> | Action executes with valid state update / navigation |
| L169 | Button | <Button size="sm" variant="outline" className="gap-1.5"> | Action executes with valid state update / navigation |
| L230 | Button | <Button | Action executes with valid state update / navigation |
| L233 | Clickable | onClick={() => handleMarkAsRead(n.id)} | Action executes with valid state update / navigation |

## src\app\citizen\page.tsx (17 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L180 | Link | <Link href="/citizen/profile?firstTime=true"> | Action executes with valid state update / navigation |
| L181 | Button | <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-medium"> | Action executes with valid state update / navigation |
| L198 | Link | <Link href="/citizen/complaints/new" className="w-full sm:w-auto"> | Action executes with valid state update / navigation |
| L199 | Button | <Button className="flex items-center justify-center gap-2 w-full sm:w-auto bg-ic-blue hover:bg-blue- | Action executes with valid state update / navigation |
| L283 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L294 | Input/Filter | <Select | Action executes with valid state update / navigation |
| L315 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L328 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L342 | Button | <Button | Action executes with valid state update / navigation |
| L345 | Clickable | onClick={clearFilters} | Action executes with valid state update / navigation |
| L370 | Button | <Button variant="outline" size="sm" onClick={() => fetchComplaints()} className="mt-4 border-rose-20 | Action executes with valid state update / navigation |
| L388 | Link | <Link href="/citizen/complaints/new"> | Action executes with valid state update / navigation |
| L389 | Button | <Button size="sm" className="bg-ic-blue text-white font-medium">Submit Your First Complaint</Button> | Action executes with valid state update / navigation |
| L453 | Button | <Button | Action executes with valid state update / navigation |
| L457 | Clickable | onClick={() => setPage((p) => Math.max(1, p - 1))} | Action executes with valid state update / navigation |
| L463 | Button | <Button | Action executes with valid state update / navigation |
| L467 | Clickable | onClick={() => setPage((p) => Math.min(totalPages, p + 1))} | Action executes with valid state update / navigation |

## src\app\citizen\profile\page.tsx (14 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L195 | Form | <form onSubmit={handleSaveProfile} className="space-y-6"> | Action executes with valid state update / navigation |
| L226 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L233 | Input/Filter | <input | Action executes with valid state update / navigation |
| L240 | Button | <Button | Action executes with valid state update / navigation |
| L245 | Clickable | onClick={() => fileInputRef.current?.click()} | Action executes with valid state update / navigation |
| L268 | Button | <button | Action executes with valid state update / navigation |
| L271 | Clickable | onClick={() => setAvatarUrl(url)} | Action executes with valid state update / navigation |
| L288 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L307 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L323 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L339 | Input/Filter | <Textarea | Action executes with valid state update / navigation |
| L352 | Button | <Button | Action executes with valid state update / navigation |
| L355 | Clickable | onClick={() => router.push('/citizen')} | Action executes with valid state update / navigation |
| L360 | Button | <Button type="submit" disabled={saving} className="w-full sm:w-auto"> | Action executes with valid state update / navigation |

## src\app\(auth)\login\citizen\page.tsx (11 controls)

| Line | Type | Code Snippet | Expected Outcome |
| --- | --- | --- | --- |
| L306 | Form | <form onSubmit={handleSendOtp} className="space-y-4"> | Action executes with valid state update / navigation |
| L315 | Input/Filter | <Input | Action executes with valid state update / navigation |
| L329 | Button | <Button | Action executes with valid state update / navigation |
| L345 | Form | <form onSubmit={handleVerifyOtp} className="space-y-5"> | Action executes with valid state update / navigation |
| L357 | Button | <Button | Action executes with valid state update / navigation |
| L361 | Clickable | onClick={() => setOtp(generatedOtp)} | Action executes with valid state update / navigation |
| L382 | Button | <Button | Action executes with valid state update / navigation |
| L398 | Button | <button | Action executes with valid state update / navigation |
| L400 | Clickable | onClick={() => { | Action executes with valid state update / navigation |
| L413 | Button | <button | Action executes with valid state update / navigation |
| L415 | Clickable | onClick={() => handleSendOtp()} | Action executes with valid state update / navigation |

