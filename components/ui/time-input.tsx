'use client';

import * as React from 'react';
import { Input } from '@/components/ui/input';

interface TimeInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string) => void;
}

export function TimeInput({ value, onChange, ...props }: TimeInputProps) {
  return (
    <Input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      {...props}
    />
  );
} 