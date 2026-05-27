'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

interface TextInputProps {
  type: 'email' | 'password'
  value: string
  placeholder: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export function TextInput({ type, value, placeholder, onChange }: TextInputProps) {
  const isPasswordField = type === 'password'
  const [showPassword, setShowPassword] = useState(false)
  const inputType = isPasswordField && showPassword ? 'text' : type

  return (
    <div className="relative w-full rounded-[14px]">
      <div aria-hidden="true" className="absolute inset-0 rounded-[14px] bg-[#f8fafc]" />
      <div aria-hidden="true" className="absolute inset-0 rounded-[14px] border border-[#cbd5e1]" />

      <div className="relative z-10">
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`h-[56px] w-full bg-transparent border-none outline-none !pl-4 ${
            isPasswordField ? '!pr-[48px]' : '!pr-4'
          } font-medium text-[16px] leading-[24px] ${
            value ? 'text-[#111]' : 'text-[#999]'
          } placeholder:text-[#999]`}
          required
        />
      </div>

      {isPasswordField && (
        <button
          type="button"
          aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-2 top-1/2 z-20 -translate-y-1/2 p-1 text-[#64748b] hover:text-[#334155]"
        >
          {showPassword ? <EyeOff size={20} strokeWidth={2} /> : <Eye size={20} strokeWidth={2} />}
        </button>
      )}

      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0px_4px_4px_0px_rgba(0,0,0,0.25)]" />
    </div>
  )
}
