import React from 'react';
import * as Lucide from 'lucide-react';

const CustomCar: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'currentColor', className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size} fill={color} className={className}>
    <path d="M199.2 181.4L173.1 256L466.9 256L440.8 181.4C436.3 168.6 424.2 160 410.6 160L229.4 160C215.8 160 203.7 168.6 199.2 181.4zM103.6 260.8L138.8 160.3C152.3 121.8 188.6 96 229.4 96L410.6 96C451.4 96 487.7 121.8 501.2 160.3L536.4 260.8C559.6 270.4 576 293.3 576 320L576 512C576 529.7 561.7 544 544 544L512 544C494.3 544 480 529.7 480 512L480 480L160 480L160 512C160 529.7 145.7 544 128 544L96 544C78.3 544 64 529.7 64 512L64 320C64 293.3 80.4 270.4 103.6 260.8zM192 368C192 350.3 177.7 336 160 336C142.3 336 128 350.3 128 368C128 385.7 142.3 400 160 400C177.7 400 192 385.7 192 368zM480 400C497.7 400 512 385.7 512 368C512 350.3 497.7 336 480 336C462.3 336 448 350.3 448 368C448 385.7 462.3 400 480 400z" />
  </svg>
);

const CustomBaby: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'currentColor', className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width={size} height={size} fill={color} className={className} style={{ transform: 'scaleX(-1)', transformOrigin: 'center' }}>
    <path d="M248 152C248 112.2 280.2 80 320 80C359.8 80 392 112.2 392 152C392 191.8 359.8 224 320 224C280.2 224 248 191.8 248 152zM135.7 208.5C148.7 190.6 173.7 186.7 191.6 199.7L227.8 226C254.6 245.5 286.9 256 320 256C353.1 256 385.4 245.5 412.2 226L448.4 199.6C466.3 186.6 491.3 190.6 504.3 208.4C517.3 226.2 513.3 251.3 495.5 264.3L459.3 290.7C445.7 300.6 431.2 308.9 416 315.7L416 352L224 352L224 315.7C208.8 309 194.3 300.6 180.7 290.7L144.5 264.3C126.6 251.3 122.7 226.3 135.7 208.4zM225.5 393.3L286.1 446.3L260.1 483.5L284.4 507.8C300 523.4 300 548.7 284.4 564.4C268.8 580.1 243.5 580 227.8 564.4L179.8 516.4C166 502.6 164.1 481 175.2 465.1L225.4 393.3zM354 446.3L414.6 393.3L464.8 465.1C475.9 481 474 502.6 460.3 516.3L412.3 564.3C396.7 579.9 371.4 579.9 355.7 564.3C340 548.7 340.1 523.4 355.7 507.7L380 483.4L354 446.2z" />
  </svg>
);

const CustomPopcorn: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'currentColor', className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M18 8a2 2 0 0 0 0-4 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0-4 0 2 2 0 0 0 0 4" />
    <path d="M10 22 9 8" />
    <path d="m14 22 1-14" />
    <path d="M20 8c.5 0 .9.4.8 1l-2.6 12c-.1.5-.7 1-1.2 1H7c-.6 0-1.1-.4-1.2-1L3.2 9c-.1-.6.3-1 .8-1Z" />
  </svg>
);

const CustomMotorbike: React.FC<{ size?: number; color?: string; className?: string }> = ({ size = 20, color = 'currentColor', className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ transform: 'scaleX(-1)', transformOrigin: 'center' }}>
    <path d="m18 14-1-3" />
    <path d="m3 9 6 2a2 2 0 0 1 2-2h2a2 2 0 0 1 1.99 1.81" />
    <path d="M8 17h3a1 1 0 0 0 1-1 6 6 0 0 1 6-6 1 1 0 0 0 1-1v-.75A5 5 0 0 0 17 5" />
    <circle cx="19" cy="17" r="3" />
    <circle cx="5" cy="17" r="3" />
  </svg>
);

const rawIconMap: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string }>> = {
  // Food & Drink
  '\u{1F354}': Lucide.Utensils,       // 🍔
  '\u{2615}': Lucide.Coffee,          // ☕
  '\u{1F355}': Lucide.Pizza,          // 🍕
  '\u{1F6D2}': Lucide.ShoppingCart,   // 🛒
  '\u{1F9FA}': Lucide.ShoppingBasket, // 🧺 groceries
  '\u{1F382}': Lucide.Cake,           // 🎂
  '\u{1F37F}': CustomPopcorn,         // 🍿

  // Transport
  '\u{1F697}': Lucide.Car,            // 🚗
  '\u{26FD}': Lucide.Fuel,            // ⛽
  '\u{2708}️': Lucide.Plane,     // ✈️
  '\u{1F68C}': Lucide.Bus,            // 🚌
  '\u{1F6B2}': Lucide.Bike,           // 🚲
  '\u{1F698}': CustomCar,             // 🚘
  '\u{1F3CD}': CustomMotorbike,       // 🏍️

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
  '\u{1F39F}': Lucide.Ticket,         // 🎟️
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
  '\u{1F6BC}': CustomBaby,            // 🚼
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
  'popcorn': CustomPopcorn,
  'motorbike': CustomMotorbike,
  'motorcycle': CustomMotorbike,
  'car': CustomCar,
};

const iconMap: Record<string, React.ComponentType<{ size?: number; color?: string; className?: string }>> = {};
for (const [key, val] of Object.entries(rawIconMap)) {
  const cleanKey = key.replace(/[\uFE00-\uFE0F]/g, '');
  iconMap[cleanKey] = val;
}

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
  const normalizedIcon = icon?.trim().replace(/[\uFE00-\uFE0F]/g, '');
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
