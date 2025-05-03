'use client';

import { redirect } from 'next/navigation';

export default function MegapotRedirect() {
  redirect('/megapot');
  return null;
}