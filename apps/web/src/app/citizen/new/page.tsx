import { redirect } from 'next/navigation';

export default function RedirectNewComplaint() {
  redirect('/citizen/complaints/new');
}
