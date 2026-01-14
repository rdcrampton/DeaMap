import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { sendPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

const forgotPasswordSchema = z.object({
  email: z.string().email('Email inválido'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = forgotPasswordSchema.parse(body);

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email.toLowerCase() },
    });

    // Don't reveal if user exists or not for security
    // Always return success message
    if (!user) {
      return NextResponse.json(
        {
          message:
            'Si el email existe en nuestro sistema, recibirás un correo con instrucciones para recuperar tu contraseña.',
        },
        { status: 200 }
      );
    }

    // Generate secure reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Save token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        reset_token: resetToken,
        reset_token_expires: resetTokenExpires,
      },
    });

    // Send reset email
    try {
      await sendPasswordResetEmail({
        to: user.email,
        resetToken,
        userName: user.name,
      });
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Don't expose email sending errors to the user
    }

    return NextResponse.json(
      {
        message:
          'Si el email existe en nuestro sistema, recibirás un correo con instrucciones para recuperar tu contraseña.',
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
