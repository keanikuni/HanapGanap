-- CreateEnum
CREATE TYPE "Role" AS ENUM ('guest', 'student', 'organizer', 'admin');

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "university" (
    "university_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email_domain" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "university_pkey" PRIMARY KEY ("university_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "guests" (
    "guest_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "contact_number" TEXT NOT NULL,
    "school_or_affiliation" TEXT,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("guest_id")
);

-- CreateTable
CREATE TABLE "students" (
    "student_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "university_id" INTEGER NOT NULL,
    "student_number" TEXT NOT NULL,
    "course_program" TEXT NOT NULL,
    "year_level" TEXT NOT NULL,
    "qr_token" TEXT NOT NULL DEFAULT gen_random_uuid()::text,

    CONSTRAINT "students_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "organizers" (
    "organizer_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "university_id" INTEGER NOT NULL,
    "org_name" TEXT NOT NULL,

    CONSTRAINT "organizers_pkey" PRIMARY KEY ("organizer_id")
);

-- CreateTable
CREATE TABLE "admins" (
    "admin_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "university_id" INTEGER NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("admin_id")
);

-- CreateTable
CREATE TABLE "event_category" (
    "category_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "event_category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "events" (
    "event_id" SERIAL NOT NULL,
    "university_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "organizer_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "start_datetime" TIMESTAMP(3) NOT NULL,
    "end_datetime" TIMESTAMP(3) NOT NULL,
    "participant_limit" INTEGER NOT NULL,
    "registration_deadline" TIMESTAMP(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'upcoming',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "image" (
    "image_id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_path" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_pkey" PRIMARY KEY ("image_id")
);

-- CreateTable
CREATE TABLE "registration" (
    "registration_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "is_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_pkey" PRIMARY KEY ("registration_id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "attendance_id" SERIAL NOT NULL,
    "registration_id" INTEGER NOT NULL,
    "in_time" TIMESTAMP(3),
    "is_confirm" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("attendance_id")
);

-- CreateTable
CREATE TABLE "notification" (
    "notification_id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "notification_pkey" PRIMARY KEY ("notification_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "university_name_key" ON "university"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "guests_user_id_key" ON "guests"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_qr_token_key" ON "students"("qr_token");

-- CreateIndex
CREATE INDEX "students_university_id_idx" ON "students"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_university_id_student_number_key" ON "students"("university_id", "student_number");

-- CreateIndex
CREATE UNIQUE INDEX "organizers_user_id_key" ON "organizers"("user_id");

-- CreateIndex
CREATE INDEX "organizers_university_id_idx" ON "organizers"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_user_id_key" ON "admins"("user_id");

-- CreateIndex
CREATE INDEX "admins_university_id_idx" ON "admins"("university_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_category_name_key" ON "event_category"("name");

-- CreateIndex
CREATE INDEX "events_university_id_idx" ON "events"("university_id");

-- CreateIndex
CREATE INDEX "events_category_id_idx" ON "events"("category_id");

-- CreateIndex
CREATE INDEX "events_organizer_id_idx" ON "events"("organizer_id");

-- CreateIndex
CREATE INDEX "events_status_start_datetime_idx" ON "events"("status", "start_datetime");

-- CreateIndex
CREATE INDEX "image_event_id_idx" ON "image"("event_id");

-- CreateIndex
CREATE INDEX "registration_event_id_idx" ON "registration"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "registration_user_id_event_id_key" ON "registration"("user_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_registration_id_key" ON "attendance"("registration_id");

-- CreateIndex
CREATE INDEX "notification_user_id_idx" ON "notification"("user_id");

-- CreateIndex
CREATE INDEX "notification_event_id_idx" ON "notification"("event_id");

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "university"("university_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizers" ADD CONSTRAINT "organizers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizers" ADD CONSTRAINT "organizers_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "university"("university_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "university"("university_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_university_id_fkey" FOREIGN KEY ("university_id") REFERENCES "university"("university_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "event_category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "organizers"("organizer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image" ADD CONSTRAINT "image_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration" ADD CONSTRAINT "registration_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration" ADD CONSTRAINT "registration_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "registration"("registration_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
