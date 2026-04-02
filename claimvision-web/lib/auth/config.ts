import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/db/connect';
import User from '@/models/User';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      httpOptions: { timeout: 10_000 },
    }),

    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        await connectDB();

        const user = await User.findOne({
          email: credentials.email.toLowerCase(),
        }).select('+password');

        if (!user) throw new Error('No account found with this email');
        if (user.provider !== 'credentials') {
          throw new Error(`Please sign in with ${user.provider}`);
        }
        if (!user.password) throw new Error('Invalid account configuration');

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) throw new Error('Incorrect password');

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        await connectDB();
        const existing = await User.findOne({ email: user.email! });
        if (!existing) {
          await User.create({
            name: user.name,
            email: user.email,
            provider: 'google',
            providerId: account.providerAccountId,
          });
        }
      }
      return true;
    },

    async jwt({ token, user, trigger }) {
      if (user) {
        // On OAuth sign-in (e.g. Google), `user.id` is the provider id, not our DB user _id.
        // So we map to our DB user by email.
        const email = (user as any).email as string | undefined;
        if (email) {
          await connectDB();
          const dbUser = await User.findOne({ email: email.toLowerCase() }).select('_id role');
          if (dbUser) {
            token.id = dbUser._id.toString();
            token.role = dbUser.role ?? 'user';
          }
        }

        // Credentials provider already returns `{ id: <dbUserId> }`
        if (!token.id) {
          token.id = (user as any).id ?? token.id;
        }
        if (!token.role) {
          token.role = (user as any).role ?? 'user';
        }
      }

      const id = typeof token.id === 'string' ? token.id : '';
      if (/^[0-9a-fA-F]{24}$/.test(id)) {
        const shouldRefreshPhone =
          trigger === 'update' ||
          Boolean(user) ||
          token.phoneComplete === undefined;

        if (shouldRefreshPhone) {
          await connectDB();
          const dbUser = await User.findById(id).select('phone').lean();
          token.phoneComplete = Boolean(dbUser?.phone && String(dbUser.phone).trim().length > 0);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token && session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).phoneComplete = token.phoneComplete === true;
      }
      return session;
    },
  },

  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },

  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // 30 days
  secret: process.env.NEXTAUTH_SECRET,
};
