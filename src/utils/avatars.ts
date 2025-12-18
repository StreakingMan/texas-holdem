import {
  // Animals
  Bird,
  Bug,
  Cat,
  Dog,
  Fish,
  Rabbit,
  Rat,
  Snail,
  Squirrel,
  Turtle,
  // Nature & Food
  Apple,
  Cherry,
  Citrus,
  Grape,
  Leaf,
  TreeDeciduous,
  Flower2,
  Clover,
  // Fun
  Ghost,
  Skull,
  Smile,
  Heart,
  Star,
  Moon,
  Sun,
  Zap,
  Flame,
  Snowflake,
  // Objects
  Crown,
  Gem,
  Rocket,
  Gamepad2,
  Music,
  Coffee,
  Pizza,
  IceCream,
  Candy,
  Cookie,
  // More
  Anchor,
  Compass,
  Target,
  Shield,
  Swords,
  Wand2,
  Dumbbell,
  Trophy,
} from "lucide-vue-next";
import type { Component } from "vue";

export interface AvatarInfo {
  id: string;
  icon: Component;
  color: string;
}

export const avatarList: AvatarInfo[] = [
  // Animals
  { id: "bird", icon: Bird, color: "text-sky-400" },
  { id: "bug", icon: Bug, color: "text-lime-400" },
  { id: "cat", icon: Cat, color: "text-orange-400" },
  { id: "dog", icon: Dog, color: "text-amber-400" },
  { id: "fish", icon: Fish, color: "text-blue-400" },
  { id: "rabbit", icon: Rabbit, color: "text-pink-300" },
  { id: "rat", icon: Rat, color: "text-gray-400" },
  { id: "snail", icon: Snail, color: "text-yellow-400" },
  { id: "squirrel", icon: Squirrel, color: "text-orange-300" },
  { id: "turtle", icon: Turtle, color: "text-emerald-400" },
  // Nature & Food
  { id: "apple", icon: Apple, color: "text-red-400" },
  { id: "cherry", icon: Cherry, color: "text-red-500" },
  { id: "citrus", icon: Citrus, color: "text-orange-400" },
  { id: "grape", icon: Grape, color: "text-purple-400" },
  { id: "leaf", icon: Leaf, color: "text-green-400" },
  { id: "tree", icon: TreeDeciduous, color: "text-emerald-500" },
  { id: "flower", icon: Flower2, color: "text-pink-400" },
  { id: "clover", icon: Clover, color: "text-green-500" },
  // Fun
  { id: "ghost", icon: Ghost, color: "text-purple-300" },
  { id: "skull", icon: Skull, color: "text-gray-300" },
  { id: "smile", icon: Smile, color: "text-yellow-400" },
  { id: "heart", icon: Heart, color: "text-red-400" },
  { id: "star", icon: Star, color: "text-amber-400" },
  { id: "moon", icon: Moon, color: "text-indigo-300" },
  { id: "sun", icon: Sun, color: "text-yellow-500" },
  { id: "zap", icon: Zap, color: "text-yellow-400" },
  { id: "flame", icon: Flame, color: "text-orange-500" },
  { id: "snowflake", icon: Snowflake, color: "text-cyan-300" },
  // Objects
  { id: "crown", icon: Crown, color: "text-amber-400" },
  { id: "gem", icon: Gem, color: "text-cyan-400" },
  { id: "rocket", icon: Rocket, color: "text-blue-400" },
  { id: "gamepad", icon: Gamepad2, color: "text-purple-400" },
  { id: "music", icon: Music, color: "text-pink-400" },
  { id: "coffee", icon: Coffee, color: "text-amber-600" },
  { id: "pizza", icon: Pizza, color: "text-orange-400" },
  { id: "icecream", icon: IceCream, color: "text-pink-300" },
  { id: "candy", icon: Candy, color: "text-red-400" },
  { id: "cookie", icon: Cookie, color: "text-amber-500" },
  // Adventure
  { id: "anchor", icon: Anchor, color: "text-slate-400" },
  { id: "compass", icon: Compass, color: "text-amber-400" },
  { id: "target", icon: Target, color: "text-red-500" },
  { id: "shield", icon: Shield, color: "text-blue-400" },
  { id: "swords", icon: Swords, color: "text-gray-300" },
  { id: "wand", icon: Wand2, color: "text-purple-400" },
  { id: "dumbbell", icon: Dumbbell, color: "text-slate-500" },
  { id: "trophy", icon: Trophy, color: "text-yellow-500" },
];

export function getAvatarById(id: string): AvatarInfo | undefined {
  return avatarList.find((a) => a.id === id);
}

export function getRandomAvatar(): AvatarInfo {
  return avatarList[Math.floor(Math.random() * avatarList.length)]!;
}
