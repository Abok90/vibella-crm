'use client'

import { MessageCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface WhatsAppButtonProps {
  phone: string
  customerName: string
  orderId: string
  amount: string
  template: string
}

export function WhatsAppButton({ phone, customerName, orderId, amount, template }: WhatsAppButtonProps) {
  const handleWhatsAppClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const message = template
      .replace('%{name}', customerName)
      .replace('%{orderId}', orderId)
      .replace('%{amount}', amount)
    
    // Default country code handling could be added here
    const cleanPhone = phone.replace(/[^0-9+]/g, '')
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    
    window.open(url, '_blank')
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleWhatsAppClick}
      className="p-2 rounded-full bg-[#E8F5E9] text-[#2E7D32] hover:bg-[#C8E6C9] dark:bg-[#1B5E20]/30 dark:text-[#81C784] transition-colors shadow-sm"
      title="WhatsApp"
    >
      <MessageCircle className="w-4 h-4" />
    </motion.button>
  )
}
