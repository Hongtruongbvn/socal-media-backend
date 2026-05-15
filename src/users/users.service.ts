// apps/api/src/users/users.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { faker as fakerVI } from '@faker-js/faker/locale/vi';
import { faker } from '@faker-js/faker';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { UpdateUserDto } from './dto/update-user.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/schemas/notification.schema';

import {
  Post as PostEntity,
  PostDocument,
  ModerationStatus,
  PostVisibility,
  ReactionType,
} from '../posts/schemas/post.schema';

import * as fs from 'fs';
import * as path from 'path';

// =================== Helpers tạo username 6–12 ký tự ===================
const MIN_U = 6;
const MAX_U = 12;

const toAscii = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();

const makeBaseUsername = (fullName: string): string => {
  let base = toAscii(fullName).replace(/[^a-z0-9]+/g, '');
  if (!base) base = 'user';
  if (base.length < MIN_U) {
    base += fakerVI.random.alphaNumeric(MIN_U - base.length).toLowerCase();
  } else if (base.length > MAX_U) {
    base = base.slice(0, MAX_U);
  }
  return base;
};

const makeUniqueUsername = (base: string, used: Set<string>): string => {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  for (let i = 0; i < 50; i++) {
    const room = Math.max(0, MAX_U - base.length);
    const suffixLen = room > 0 ? Math.min(room, 4) : 2;
    const prefixLen = MAX_U - suffixLen;
    const cand1 = (base + fakerVI.random.numeric(suffixLen)).slice(0, MAX_U);
    if (!used.has(cand1)) {
      used.add(cand1);
      return cand1;
    }
    const cand2 = base.slice(0, prefixLen) + fakerVI.random.numeric(suffixLen);
    if (!used.has(cand2)) {
      used.add(cand2);
      return cand2;
    }
  }
  const fallback = fakerVI.random.alphaNumeric(MAX_U).toLowerCase();
  used.add(fallback);
  return fallback;
};

type UserSeed = {
  username: string;
  email?: string;
  password?: string;
  bio?: string;
  avatar?: string;
  coverImage?: string;
  birthday?: Date;
  purchasedItems?: string[];
  activeItem?: string | null;
  equippedAvatarFrame?: Types.ObjectId | null | undefined;
  friends?: Types.ObjectId[];
};

// ========== Nội dung & ẢNH theo chủ đề (ƯU TIÊN LOCAL, fallback Picsum) ==========
const VI_LOCATIONS = [
  'Hà Nội',
  'Đà Nẵng',
  'TP.HCM',
  'Hải Phòng',
  'Cần Thơ',
  'Nha Trang',
  'Huế',
  'Vũng Tàu',
  'Buôn Ma Thuột',
  'Đà Lạt',
  'Quy Nhơn',
  'Phan Thiết',
  'Hạ Long',
  'Nam Định',
  'Thái Nguyên',
  'Biên Hòa',
  'Thủ Đức',
  'Tân Uyên',
  'Thành phố Vinh',
];
const VI_DISHES = [
  'bún bò Huế',
  'phở bò',
  'mì cay',
  'bánh cuốn',
  'bánh mì trứng',
  'cơm tấm sườn bì chả',
  'hủ tiếu nam vang',
  'bánh canh cua',
  'bún chả',
  'bánh xèo',
  'mì Quảng',
];
const VI_COFFEE = [
  'cà phê sữa đá',
  'bạc xỉu',
  'cold brew cam sả',
  'espresso',
  'latte',
  'capuchino',
  'trà đào cam sả',
];
const TECH_STACK = [
  'NestJS',
  'MongoDB',
  'React',
  'TypeScript',
  'Next.js',
  'Docker',
  'Redis',
  'RabbitMQ',
  'Prisma',
];
const MUSIC_GENRES = [
  'lofi',
  'indie Việt',
  'pop ballad',
  'V-Pop',
  'US-UK 2000s',
  'EDM',
];
const MOVIE_GENRES = [
  'phim trinh thám',
  'phim hoạt hình',
  'phim khoa học viễn tưởng',
  'phim tâm lý',
  'phim hành động',
];
const GENERAL_HASHTAGS = [
  '#daily',
  '#cuocsong',
  '#chill',
  '#coding',
  '#music',
  '#movie',
  '#travel',
  '#amthuc',
  '#coffee',
];
const EMOJI_HAPPY = [
  '😄',
  '✨',
  '🔥',
  '❤️',
  '🎵',
  '📷',
  '☕',
  '🥳',
  '🍜',
  '💻',
  '🎬',
  '🌿',
  '🌅',
  '👍',
];

const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const pickN = <T>(arr: T[], n: number) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(n, a.length)));
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const sentence = (parts: string[]) =>
  cap(parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()) + '.';

type GenPostResult = { content: string; mediaUrls: string[] };

// ----- ẢNH LOCAL ƯU TIÊN -----
const SEED_DIR = path.join(process.cwd(), 'uploads', 'seed');
type SeedTopic = 'food' | 'coffee' | 'city' | 'architecture';

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
(['food', 'coffee', 'city', 'architecture'] as SeedTopic[]).forEach((t) =>
  ensureDir(path.join(SEED_DIR, t)),
);

function getLocalImage(topic: SeedTopic): string | null {
  const dir = path.join(SEED_DIR, topic);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));
  if (!files.length) return null;
  const f = files[Math.floor(Math.random() * files.length)];
  // /uploads đã được serve static trong main.ts
  return `/uploads/seed/${topic}/${f}`;
}

const picsum = (w = 1200, h = 800) =>
  `https://picsum.photos/seed/${fakerVI.random.alphaNumeric(8)}/${w}/${h}`;

function topicImages(topic: SeedTopic, count = 1): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const local = getLocalImage(topic);
    out.push(local ?? picsum(1200, 800));
  }
  return out;
}

// ----- Generators theo chủ đề -----
const genFoodPost = (): GenPostResult => {
  const dish = pick(VI_DISHES);
  const city = pick(VI_LOCATIONS);
  const feel = pick([
    'khá ngon',
    'ổn áp',
    'đậm vị',
    'giá ok',
    'đáng thử',
    'hơi mặn nhưng ổn',
  ]);
  const text = sentence([
    `Hôm nay ăn ${dish} ở ${city}, ${feel}`,
    pick(EMOJI_HAPPY),
  ]);
  return {
    content: `${text} #amthuc #daily`,
    mediaUrls: topicImages('food', 1),
  };
};

const genCoffeePost = (): GenPostResult => {
  const drink = pick(VI_COFFEE);
  const city = pick(VI_LOCATIONS);
  const text = sentence([
    `Ngồi quán nhỏ ở ${city}, gọi ${drink}, nghe nhạc nhẹ`,
    pick(EMOJI_HAPPY),
  ]);
  return {
    content: `${text} #coffee #chill`,
    mediaUrls: topicImages('coffee', 1),
  };
};

const genCodingPost = (): GenPostResult => {
  const tech = pick(TECH_STACK);
  const feel = pick([
    'cuối cùng cũng xong',
    'học được khối điều hay ho',
    'đang vướng chỗ tối ưu query',
    'merge PR thành công',
  ]);
  const text = sentence([`Vừa nghịch ${tech}, ${feel}`, pick(EMOJI_HAPPY)]);
  return { content: `${text} #coding #tech`, mediaUrls: [] };
};

const genTravelPost = (): GenPostResult => {
  const city = pick(VI_LOCATIONS);
  const text = sentence([
    `Dạo một vòng ${city}, thời tiết dễ chịu`,
    pick(EMOJI_HAPPY),
  ]);
  return {
    content: `${text} #travel #daily`,
    mediaUrls: topicImages('city', rand(1, 3)),
  };
};

const genMusicPost = (): GenPostResult => {
  const g = pick(MUSIC_GENRES);
  const text = sentence([
    `Đang nghe playlist ${g}, thư giãn hẳn`,
    pick(EMOJI_HAPPY),
  ]);
  return { content: `${text} #music #chill`, mediaUrls: [] };
};

const genMoviePost = (): GenPostResult => {
  const g = pick(MOVIE_GENRES);
  const text = sentence([
    `Vừa xem ${g}, nội dung ổn, hình ảnh đẹp`,
    pick(EMOJI_HAPPY),
  ]);
  return { content: `${text} #movie`, mediaUrls: [] };
};

const genPhotoPost = (): GenPostResult => {
  const city = pick(VI_LOCATIONS);
  const text = sentence([`Chụp nhanh một góc ở ${city}`, pick(EMOJI_HAPPY)]);
  return {
    content: `${text} #daily #photo`,
    mediaUrls: topicImages('architecture', rand(1, 2)),
  };
};

const genLifePost = (): GenPostResult => {
  const text = sentence([
    pick([
      'Hôm nay xử lý xong mớ việc tồn',
      'Cuối ngày ngồi tổng kết một chút',
      'Đầu tuần nhẹ nhàng',
      'Cuối tuần nghỉ ngơi tái tạo năng lượng',
    ]),
    pick(EMOJI_HAPPY),
  ]);
  const tags = pickN(GENERAL_HASHTAGS, rand(0, 2)).join(' ');
  return { content: `${text}${tags ? ' ' + tags : ''}`, mediaUrls: [] };
};

// Trộn chủ đề có trọng số
const TOPIC_POOL = [
  genFoodPost,
  genFoodPost,
  genCoffeePost,
  genCodingPost,
  genCodingPost,
  genTravelPost,
  genTravelPost,
  genPhotoPost,
  genPhotoPost,
  genMusicPost,
  genMoviePost,
  genLifePost,
];
function genPostVI(): GenPostResult {
  return pick(TOPIC_POOL)();
}

// ========= thời gian & reactions helpers ==========
const randomDateWithin = (days: number) => {
  const now = Date.now();
  const past = now - days * 24 * 60 * 60 * 1000;
  return new Date(rand(past, now));
};
const randomDateAfter = (start: Date) =>
  new Date(rand(start.getTime(), Date.now()));

const weightedPickReaction = (): ReactionType => {
  const bag: ReactionType[] = [
    ReactionType.LIKE,
    ReactionType.LIKE,
    ReactionType.LIKE,
    ReactionType.LIKE,
    ReactionType.LIKE,
    ReactionType.LOVE,
    ReactionType.LOVE,
    ReactionType.LOVE,
    ReactionType.HAHA,
    ReactionType.WOW,
    ReactionType.SAD,
    ReactionType.ANGRY,
  ];
  return pick(bag);
};

const sampleUnique = <T>(arr: T[], k: number) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, k);
};

type LeanPostForReaction = {
  _id: Types.ObjectId;
  author: Types.ObjectId;
  createdAt?: Date;
  reactions?: {
    user?: Types.ObjectId;
    type?: ReactionType;
    createdAt?: Date;
  }[];
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PostEntity.name) private postModel: Model<PostDocument>,
    private notificationsService: NotificationsService,
  ) {}

  // ===== PUBLIC
  async findPublicById(id: string | Types.ObjectId): Promise<UserDocument> {
    const idStr = String(id);
    if (!Types.ObjectId.isValid(idStr)) {
      throw new NotFoundException(`Không tìm thấy người dùng với id=${idStr}`);
    }
    const user = await this.userModel
      .findById(idStr)
      .select('-password -email')
      .populate({ path: 'equippedAvatarFrame', select: 'assetUrl type' })
      .exec();
    if (!user)
      throw new NotFoundException(`Không tìm thấy người dùng với id=${idStr}`);
    return user;
  }

  async findByUsernameOrId(param: string): Promise<UserDocument> {
    const isId = Types.ObjectId.isValid(param);
    const query = isId
      ? this.userModel.findById(param)
      : this.userModel.findOne({ username: param });
    const user = await query
      .select('-password -email')
      .populate({ path: 'equippedAvatarFrame', select: 'assetUrl type' })
      .exec();
    if (!user) {
      throw new NotFoundException(
        isId
          ? `Không tìm thấy người dùng với id=${param}`
          : `Không tìm thấy người dùng ${param}`,
      );
    }
    return user;
  }

  // ===== Seed USERS
  async generateFakeUsers(
    num: number,
  ): Promise<{ inserted: number; tried: number; duplicates?: number }> {
    const used = new Set<string>();
    const exists = await this.userModel.find().select('username').lean();
    for (const e of exists) if (e?.username) used.add(e.username);

    const docs: UserSeed[] = Array.from({ length: num }).map(() => {
      const fullName = fakerVI.name.fullName();
      const base = makeBaseUsername(fullName);
      const username = makeUniqueUsername(base, used);
      const email = `${username}@example.com`;
      const password = 'Seed@12345';
      return {
        username,
        email,
        password,
        bio: fakerVI.helpers.arrayElement([
          'Xin chào mọi người!',
          'Chia sẻ điều thú vị mỗi ngày.',
          'Yêu lập trình và bóng đá.',
          'Đang học NestJS + MongoDB.',
        ]),
        avatar: fakerVI.image.avatar(),
        coverImage: '',
        birthday: fakerVI.date.birthdate({ min: 18, max: 45, mode: 'age' }),
        purchasedItems: [],
        activeItem: null,
        equippedAvatarFrame: null,
        friends: [],
      };
    });

    try {
      const created = await this.userModel.insertMany(docs as any, {
        ordered: false,
      });
      return { inserted: created.length, tried: docs.length };
    } catch (err: any) {
      const inserted = Array.isArray(err?.insertedDocs)
        ? err.insertedDocs.length
        : 0;
      const duplicates = Array.isArray(err?.writeErrors)
        ? err.writeErrors.length
        : Array.isArray(err?.result?.result?.writeErrors)
          ? err.result.result.writeErrors.length
          : undefined;
      this.logger.warn(
        `Seed users partial: inserted=${inserted}/${docs.length}`,
      );
      return { inserted, tried: docs.length, duplicates };
    }
  }

  // ===== Seed POSTS (15–20 bài / user)
  async seedPostsForAllUsers(min = 15, max = 20, withinDays = 120) {
    const users = await this.userModel.find().select('_id username').lean();
    const bulkDocs: (Partial<PostEntity> & {
      createdAt?: Date;
      updatedAt?: Date;
    })[] = [];

    for (const u of users) {
      const existing = await this.postModel.countDocuments({ author: u._id });
      const target = rand(min, max);
      const need = Math.max(0, target - existing);
      if (need === 0) continue;

      for (let i = 0; i < need; i++) {
        const createdAt = randomDateWithin(withinDays);
        const { content, mediaUrls } = genPostVI();

        bulkDocs.push({
          moderationStatus: ModerationStatus.APPROVED,
          author: u._id as any,
          content,
          mediaUrls,
          reactions: [],
          commentCount: 0,
          repostCount: rand(0, 3),
          visibility: pick([
            PostVisibility.PUBLIC,
            PostVisibility.FRIENDS_ONLY,
            PostVisibility.PUBLIC,
          ]),
          createdAt,
          updatedAt: createdAt,
        });
      }
    }

    if (bulkDocs.length === 0) {
      return {
        inserted: 0,
        triedUsers: users.length,
        docsTried: 0,
        note: 'Đã đủ bài hoặc chưa có user.',
      };
    }

    const res = await this.postModel.insertMany(bulkDocs as any[], {
      ordered: false,
    });
    return {
      inserted: res.length,
      triedUsers: users.length,
      docsTried: bulkDocs.length,
    };
  }

  // ===== Seed REACTIONS cho tất cả bài
  async seedReactionsForAllPosts(min = 10, max = 40) {
    const users = await this.userModel.find().select('_id').lean();
    const allUserIds = users.map((u) => String(u._id));

    const posts = (await this.postModel
      .find()
      .select('_id author reactions createdAt')
      .lean()
      .exec()) as unknown as LeanPostForReaction[];

    let totalAdded = 0;

    for (const p of posts) {
      const already = new Set<string>(
        (p.reactions ?? [])
          .map((r) => r?.user && String(r.user))
          .filter(Boolean) as string[],
      );

      const candidates = allUserIds.filter(
        (uid) => uid !== String(p.author) && !already.has(uid),
      );
      if (candidates.length === 0) continue;

      const want = rand(min, max);
      const take = Math.min(want, candidates.length);
      const picked = sampleUnique(candidates, take);

      const baseCreated =
        p.createdAt ?? new Types.ObjectId(p._id).getTimestamp();

      const newReacts = picked.map((uid) => ({
        user: new Types.ObjectId(uid),
        type: weightedPickReaction(),
        createdAt: randomDateAfter(new Date(baseCreated)),
      }));

      await this.postModel.updateOne(
        { _id: p._id },
        { $push: { reactions: { $each: newReacts } } },
      );

      totalAdded += newReacts.length;
    }

    return { posts: posts.length, addedReactions: totalAdded };
  }

  // ===== MUTATIONS & OTHERS
  async updateProfile(
    userId: string | Types.ObjectId,
    updateUserDto: UpdateUserDto,
  ): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(userId, updateUserDto, { new: true })
      .select('-password')
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy người dùng');
    return updated;
  }

  async updateAvatar(
    userId: string | Types.ObjectId,
    avatarPath: string,
  ): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { avatar: avatarPath }, { new: true })
      .select('-password')
      .exec();
    if (!updated)
      throw new NotFoundException(
        'Không tìm thấy người dùng khi cập nhật avatar',
      );
    return updated;
  }

  async updateCover(
    userId: string | Types.ObjectId,
    coverPath: string,
  ): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { coverImage: coverPath }, { new: true })
      .select('-password')
      .exec();
    if (!updated)
      throw new NotFoundException(
        'Không tìm thấy người dùng khi cập nhật cover',
      );
    return updated;
  }

  async followUser(
    currentUserId: string | Types.ObjectId,
    userIdToFollow: string,
  ) {
    if (currentUserId.toString() === userIdToFollow) {
      throw new Error('Bạn không thể tự theo dõi chính mình.');
    }
    await this.userModel.findByIdAndUpdate(currentUserId, {
      $addToSet: { following: userIdToFollow },
    });
    await this.userModel.findByIdAndUpdate(userIdToFollow, {
      $addToSet: { followers: currentUserId },
    });
    const userToFollowDoc = await this.userModel.findById(userIdToFollow);
    const currentUserDoc = await this.userModel.findById(currentUserId);
    if (!userToFollowDoc || !currentUserDoc) {
      throw new NotFoundException(
        'Không tìm thấy người dùng để tạo thông báo.',
      );
    }
    await this.receiveXP(
      2,
      'follow',
      currentUserId.toString(),
      userIdToFollow.toString(),
    );
    await this.notificationsService.createNotification(
      userToFollowDoc,
      currentUserDoc,
      NotificationType.NEW_FOLLOWER,
      `/profile/${currentUserDoc.username}`,
    );
    return { message: 'Theo dõi thành công.' };
  }

  async unfollowUser(
    currentUserId: string | Types.ObjectId,
    userIdToUnfollow: string,
  ) {
    await this.userModel.findByIdAndUpdate(currentUserId, {
      $pull: { following: userIdToUnfollow },
    });
    await this.userModel.findByIdAndUpdate(userIdToUnfollow, {
      $pull: { followers: currentUserId },
    });
    return { message: 'Bỏ theo dõi thành công.' };
  }

  async updateUserInterests(
    userId: string,
    interestIds: string[],
  ): Promise<UserDocument> {
    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { interests: interestIds, hasSelectedInterests: true } },
        { new: true },
      )
      .populate('interests')
      .exec();
    if (!updated) throw new NotFoundException('Không tìm thấy người dùng');
    return updated;
  }

  async receiveXP(
    xp: number,
    kind: string,
    userId: string,
    _follow?: string,
  ): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      this.logger.warn(`User with ID ${userId} not found.`);
      return;
    }
    if (kind === 'follow') {
      await this.handleUserFollowed(userId);
    }
    if ((user as any).xp_per_day >= 250) {
      await this.notificationsService.createNotification(
        user,
        user,
        NotificationType.NEW_NOTIFICATION,
        null,
      );
      this.logger.log(`User ${user.username} reached daily XP limit.`);
      return;
    }
    const allowedXP = Math.max(0, 250 - ((user as any).xp_per_day ?? 0));
    const add = Math.min(xp, allowedXP);
    (user as any).xp_per_day = ((user as any).xp_per_day ?? 0) + add;
    (user as any).xp = ((user as any).xp ?? 0) + add;
    await (user as any).save();
  }

  async handleUserFollowed(followedUserId: string): Promise<void> {
    const user: any = await this.userModel.findById(followedUserId);
    if (!user) {
      this.logger.warn(`User with ID ${followedUserId} not found.`);
      return;
    }
    const baseXP = 20;
    const canAddBase = Math.max(0, 250 - (user.xp_per_day ?? 0));
    const baseAdded = Math.min(baseXP, canAddBase);
    user.xp_per_day = (user.xp_per_day ?? 0) + baseAdded;
    user.xp = (user.xp ?? 0) + baseAdded;

    const currentFollowers = user.followers?.length || 0;
    const milestones = [
      { count: 10, bonusXP: 100 },
      { count: 50, bonusXP: 300 },
      { count: 100, bonusXP: 800 },
      { count: 500, bonusXP: 3000 },
      { count: 1000, bonusXP: 7000 },
    ];
    user.milestonesReached ??= [];
    for (const m of milestones) {
      if (
        currentFollowers >= m.count &&
        !user.milestonesReached.includes(m.count)
      ) {
        const canAddBonus = Math.max(0, 250 - (user.xp_per_day ?? 0));
        const bonusAdded = Math.min(canAddBonus, m.bonusXP);
        user.xp_per_day += bonusAdded;
        user.xp += bonusAdded;
        user.milestonesReached.push(m.count);
        this.logger.log(
          `User ${user.username} đạt mốc ${m.count}. Bonus ${bonusAdded} XP.`,
        );
      }
    }
    await user.save();
  }

  async GetUserDental(id: string) {
    return this.userModel.findById(id).exec();
  }

  async getAllFriend(id: string) {
    const user = await this.userModel.findById(id).populate('friends').exec();
    if (!user) {
      throw new NotFoundException('Người dùng không tồn tại');
    }
    return (user as any).friends;
  }

  async getWarnings(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('warnings')
      .populate([
        { path: 'warnings.by', select: 'username avatar' },
        { path: 'warnings.reason', select: 'reasonText' },
      ]);
    if (!user) throw new NotFoundException('Người dùng không tồn tại.');
    return (user as any).warnings;
  }

  async deleteWarning(userId: string, warningId: string) {
    const user: any = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Người dùng không tồn tại.');
    const warningIndex = user.warnings?.findIndex(
      (w: any) => w._id?.toString() === warningId,
    );
    if (warningIndex === -1)
      throw new NotFoundException('Cảnh cáo không tồn tại.');
    user.warnings.splice(warningIndex, 1);
    await user.save();
    return { message: 'Xoá cảnh cáo thành công.' };
  }

  async getMe(userId: string | Types.ObjectId) {
    const me = await this.userModel
      .findById(userId)
      .select(
        'username email avatar coins hasSelectedInterests globalRole friends currentGame coverImage equippedAvatarFrame',
      )
      .populate({ path: 'equippedAvatarFrame', select: 'assetUrl type' })
      .lean()
      .exec();
    if (!me) throw new NotFoundException('Không tìm thấy người dùng');
    return me;
  }
}
