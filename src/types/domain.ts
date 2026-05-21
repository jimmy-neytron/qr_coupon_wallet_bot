export type SpaceType = 'personal' | 'shared';
export type SpaceRole = 'owner' | 'member';
export type CouponType = 'qr' | 'text';

export type AppUser = {
  id: string;
  telegram_user_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Space = {
  id: string;
  owner_user_id: string;
  title: string;
  type: SpaceType;
  created_at: string;
  updated_at: string;
  role?: SpaceRole;
};

export type SpaceMember = {
  space_id: string;
  user_id: string;
  role: SpaceRole;
  created_at: string;
  user?: AppUser;
};

export type CouponGroup = {
  id: string;
  space_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  coupons_count?: number;
};

export type Coupon = {
  id: string;
  space_id: string;
  group_id: string | null;
  created_by_user_id: string | null;
  title: string;
  qr_text: string;
  note: string | null;
  type: CouponType;
  expires_at: string | null;
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by?: Pick<AppUser, 'id' | 'first_name' | 'last_name' | 'username'> | null;
};

export type Invite = {
  id: string;
  space_id: string;
  code: string;
  created_by_user_id: string;
  used_by_user_id: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type MeResponse = {
  user: AppUser;
  spaces: Space[];
};

export type CreateCouponPayload = {
  title: string;
  qr_text: string;
  type: CouponType;
  group_id?: string | null;
  note?: string | null;
  expires_at?: string | null;
};

export type UpdateCouponPayload = Partial<CreateCouponPayload> & {
  is_favorite?: boolean;
  is_archived?: boolean;
};
