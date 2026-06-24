import React from 'react';
import * as Lucide from 'lucide-react';

// Maps category icons/names to Lucide icons
const iconMap: Record<string, React.ComponentType<any>> = {
  // Emojis
  '🍔': Lucide.Utensils,
  '⛽': Lucide.Fuel,
  '👗': Lucide.Shirt,
  '💡': Lucide.Lightbulb,
  '🚌': Lucide.Bus,
  '❤️': Lucide.BriefcaseMedical,
  '🎬': Lucide.Clapperboard,
  '📦': Lucide.LayoutGrid,
  '🛒': Lucide.ShoppingCart,
  '🏠': Lucide.Home,
  '💊': Lucide.Pill,
  '🎮': Lucide.Gamepad2,
  '✈️': Lucide.Plane,
  '🎵': Lucide.Music,
  '📱': Lucide.Smartphone,
  '💼': Lucide.Briefcase,
  '🐾': Lucide.Footprints,
  '🎁': Lucide.Gift,
  '☕': Lucide.Coffee,
  '🍕': Lucide.Pizza,
  '💇': Lucide.Scissors,
  '🏋️': Lucide.Dumbbell,
  '📺': Lucide.Tv,
  '🚗': Lucide.Car,
  '🤝': Lucide.Handshake,
  '📚': Lucide.BookOpen,
  '🧪': Lucide.FlaskConical,
  '🧩': Lucide.Puzzle,
  '⛺': Lucide.Tent,
  '🎟️': Lucide.Ticket,
  '👶': Lucide.Baby,
  '🐷': Lucide.PiggyBank,
  '💸': Lucide.Banknote,
  '🧾': Lucide.Receipt,

  // Text keys
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

  // Try to find icon by emoji/key
  let IconComponent = iconMap[normalizedIcon];

  // If not found, try to find icon by category name
  if (!IconComponent && normalizedName) {
    IconComponent = iconMap[normalizedName];
  }

  if (IconComponent) {
    const LucideIcon = IconComponent;
    return <LucideIcon className={className} size={size} color={color} />;
  }

  // Fallback to text rendering (original emoji)
  return (
    <span className={className} style={{ fontSize: `${size}px`, lineHeight: 1 }}>
      {icon}
    </span>
  );
}
