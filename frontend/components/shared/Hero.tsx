'use client'

import Image from 'next/image'
import Link from 'next/link'

export function Hero() {
  return (
    <div className="flex h-[495px] w-[368px] flex-col items-center">
      <div className="h-[75px] w-[368px]">
        <Link href="/" className="block text-center font-['Patua_One'] text-[36px] text-[#15293d]">
          MORA
        </Link>
      </div>

      <div className="mt-[12px] flex w-full flex-1 items-center justify-center">
        <Image
          src="/icons/illust.png"
          alt="MORA illustration"
          width={700}
          height={700}
          priority
          className="h-auto w-[750px] max-w-full object-contain"
        />
      </div>
    </div>
  )
}
