import { Link } from "@tanstack/react-router";
import { Star, Users, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatCount } from "@/lib/format";
import { courseImage } from "@/lib/course-images";

export interface CourseCardData {
  slug: string;
  title: string;
  subtitle?: string | null;
  category: string;
  difficulty: string;
  price: number;
  price_type: string;
  duration_text?: string | null;
  thumbnail_gradient?: string | null;
  instructor_name: string;
  instructor_avatar_url?: string | null;
  rating_avg: number;
  rating_count: number;
  enrollment_count: number;
}

export function CourseCard({ course }: { course: CourseCardData }) {
  const gradient = course.thumbnail_gradient ?? "from-blue-900 to-purple-700";
  const isFree = course.price_type === "free" || course.price === 0;
  return (
    <Link
      to="/courses/$slug"
      params={{ slug: course.slug }}
      className="group block overflow-hidden rounded-xl border bg-card card-hover"
    >
      <div className={`relative aspect-video bg-gradient-to-br ${gradient} overflow-hidden`}>
        <img
          src={courseImage(course.category)}
          alt={course.title}
          loading="lazy"
          className="absolute inset-0 size-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute top-3 left-3 flex gap-2">
          <Badge className="bg-black/50 text-white border-0 backdrop-blur-sm">{course.category}</Badge>
          {isFree && <Badge className="bg-success text-success-foreground border-0">FREE</Badge>}
        </div>
        <p className="absolute bottom-3 left-4 text-white/90 text-xs font-medium drop-shadow">{course.difficulty}</p>
      </div>
      <div className="p-5 space-y-3">
        <h3 className="font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        <p className="text-xs text-muted-foreground">By {course.instructor_name}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-warning">
            <Star className="size-3.5 fill-current" />
            <span className="font-medium text-foreground">{Number(course.rating_avg).toFixed(1)}</span>
            <span className="text-muted-foreground">({formatCount(course.rating_count)})</span>
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {formatCount(course.enrollment_count)}
          </span>
          {course.duration_text && (
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {course.duration_text}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="text-lg font-bold text-primary">{formatPrice(course.price, course.price_type)}</span>
        </div>
      </div>
    </Link>
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden animate-pulse">
      <div className="aspect-video bg-muted" />
      <div className="p-5 space-y-3">
        <div className="h-5 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
    </div>
  );
}
