import React from 'react';
import * as Lucide from 'lucide-react';

const iconMap: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string }>> = {
  // Food & Drink
  '\u{1F354}': Lucide.Utensils,       // 🍔
  '\u{2615}': Lucide.Coffee,          // ☕
  '\u{1F355}': Lucide.Pizza,          // 🍕
  '\u{1F6D2}': Lucide.ShoppingCart,   // 🛒
  '\u{1F9FA}': Lucide.ShoppingBasket, // 🧺 groceries
  '\u{1F37D}️': Lucide.Utensils, // 🍽️
  '\u{1F382}': Lucide.Cake,           // 🎂

  // Transport
  '\u{1F697}': Lucide.Car,            // 🚗
  '\u{26FD}': Lucide.Fuel,            // ⛽
  '\u{2708}️': Lucide.Plane,     // ✈️
  '\u{1F68C}': Lucide.Bus,            // 🚌
  '\u{1F6B2}': Lucide.Bike,           // 🚲

  // Lifestyle & Personal
  '\u{1F457}': Lucide.Shirt,          // 👗
  '\u{1F487}': Lucide.Scissors,       // 💇 haircut
  '\u{1F486}': Lucide.Sparkles,       // 💆 self care / spa
  '\u{1F3CB}️': Lucide.Dumbbell, // 🏋️ gym
  '\u{1F490}': Lucide.Flower,         // 💐 lotus / flower
  '\u{1F9D8}': Lucide.Flower,         // 🧘 wellness / lotus
  '\u{1F6C1}': Lucide.Bath,           // 🛁 spa / bath

  // Home & Utilities
  '\u{1F3E0}': Lucide.Home,           // 🏠
  '\u{1F4A1}': Lucide.Lightbulb,      // 💡
  '\u{1F4A7}': Lucide.Droplets,       // 💧
  '\u{1F525}': Lucide.Flame,          // 🔥
  '\u{1F527}': Lucide.Wrench,         // 🔧
  '\u{1F33F}': Lucide.Leaf,           // 🌿

  // Tech & Online
  '\u{1F4F1}': Lucide.Smartphone,     // 📱
  '\u{1F5A5}️': Lucide.Monitor,  // 🖥️
  '\u{1F310}': Lucide.Globe,          // 🌐
  '\u{1F393}': Lucide.GraduationCap,  // 🎓 online classes / education

  // Entertainment
  '\u{1F3AC}': Lucide.Clapperboard,   // 🎬
  '\u{1F3AE}': Lucide.Gamepad2,       // 🎮
  '\u{1F4FA}': Lucide.Tv,             // 📺
  '\u{1F3B5}': Lucide.Music,          // 🎵
  '\u{1F39F}️': Lucide.Ticket,   // 🎟️
  '\u{1F3A8}': Lucide.Palette,        // 🎨

  // Finance & Work
  '\u{1F4BC}': Lucide.Briefcase,      // 💼
  '\u{1F4B8}': Lucide.Banknote,       // 💸
  '\u{1F437}': Lucide.PiggyBank,      // 🐷
  '\u{1F9FE}': Lucide.Receipt,        // 🧾
  '\u{1F381}': Lucide.Gift,           // 🎁

  // Health & Wellness
  '\u{2764}️': Lucide.BriefcaseMedical, // ❤️
  '\u{1F48A}': Lucide.Pill,           // 💊

  // Education & Other
  '\u{1F4DA}': Lucide.BookOpen,       // 📚
  '\u{1F4E6}': Lucide.LayoutGrid,     // 📦 other
  '\u{1F91D}': Lucide.Handshake,      // 🤝 charity
  '\u{1F476}': Lucide.Baby,           // 👶
  '\u{1F43E}': Lucide.PawPrint,       // 🐾 pets
  '\u{1F680}': Lucide.Rocket,         // 🚀
  '\u{1F3AF}': Lucide.Target,         // 🎯

  // Text keys (for default categories)
  'food': Lucide.Utensils,
  'fuel': Lucide.Fuel,
  'clothes': Lucide.Shirt,
  'utilities': Lucide.Lightbulb,
  'utils': Lucide.Lightbulb,
  'health': Lucide.BriefcaseMedical,
  'entertainment': Lucide.Clapperboard,
  'leisure': Lucide.Clapperboard,
  'transport': Lucide.Bus,
  'transit': Lucide.Bus,
  'other': Lucide.LayoutGrid,
  'charity': Lucide.Handshake,
  'education': Lucide.BookOpen,
  'gym': Lucide.Dumbbell,
  'streaming': Lucide.Tv,
  'baby': Lucide.Baby,
  'savings': Lucide.PiggyBank,
  'loan': Lucide.Banknote,
  'taxes': Lucide.Receipt,
  'groceries': Lucide.ShoppingBasket,
  'selfcare': Lucide.Sparkles,
  'self care': Lucide.Sparkles,
  'online': Lucide.GraduationCap,
};

interface CategoryIconProps {
  icon: string;
  name?: string;
  className?: string;
  size?: number;
  color?: string;
}

export default function CategoryIcon({
  icon,
  name,
  className,
  size = 20,
  color,
}: CategoryIconProps) {
  const normalizedIcon = icon?.trim();
  const normalizedName = name?.toLowerCase().trim() || '';

  let IconComponent = iconMap[normalizedIcon];

  if (!IconComponent && normalizedName) {
    IconComponent = iconMap[normalizedName];
  }

  if (IconComponent) {
    const LucideIcon = IconComponent;
    return <LucideIcon className={className} size={size} color={color} />;
  }

  return (
    <span className={className} style={{ fontSize: `${size}px`, lineHeight: 1 }}>
      {icon}
    </span>
  );
}
