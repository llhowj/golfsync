// To roll back: replace the <a> with <span>{course}</span> and remove the href/target/rel/title props.

interface CourseLinkProps {
  course: string
  className?: string
}

export function CourseLink({ course, className }: CourseLinkProps) {
  const searchTerm = /golf/i.test(course) ? course : `${course} Golf`
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(searchTerm)}`
  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Get directions"
      className={className}
      onClick={(e) => e.stopPropagation()}
    >
      {course}
    </a>
  )
}
