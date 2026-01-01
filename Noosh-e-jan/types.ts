
export interface Profile {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  cover_url?: string;
  is_admin?: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  city: string;
  address?: string;
  full_address?: string;
  phone?: string;
  description?: string;
  lat?: number;
  lng?: number;
  verified?: boolean;
  cover_image?: string;
  logo_url?: string;
  verification_code?: string;
  is_active?: boolean;
}

export type MenuCategory = 'main' | 'appetizer' | 'drink' | 'dessert' | 'other';

export interface MenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  category: MenuCategory;
  description?: string;
  image_url?: string;
  created_at: string;
}

export interface RestaurantOwner {
  id: string;
  user_id: string;
  restaurant_id: string;
  role: 'owner' | 'manager';
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

export interface Post {
  id: string;
  user_id: string;
  restaurant_id: string;
  photo_url: string;
  caption: string;
  rating: number;
  rating_food: number;
  rating_price: number;
  rating_parking: number;
  rating_ambiance: number;
  created_at: string;
  profiles?: Profile;
  restaurants?: Restaurant;
  likes?: { user_id: string; profiles?: Profile }[];
  dislikes?: { user_id: string }[];
  comments?: Comment[];
}

export interface Activity {
  id: string;
  type: 'like' | 'comment' | 'follow';
  user: {
    username: string;
    full_name: string;
    avatar_url?: string;
  };
  post_id?: string;
  content?: string;
  created_at: string;
  is_read: boolean;
}

export type ViewState = 'feed' | 'profile' | 'create' | 'auth' | 'near_me' | 'dashboard' | 'admin' | 'restaurant_detail' | 'post_detail' | 'user_profile';
