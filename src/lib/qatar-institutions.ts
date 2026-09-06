/**
 * Verified Qatar higher-education institutions — universities, colleges,
 * and other post-secondary institutions. Sourced via Firecrawl from the
 * Ministry of Education and Higher Education's official page
 * (edu.gov.qa/en/Content/HigherEducationinQatar) and cross-verified against
 * MOEHE's own official university-list PDF (dated Jan 2026). Still a static
 * list, not a live scrape at request time — "My institution isn't listed"
 * covers anything renamed/closed since.
 *
 * Used for every non-secondary education level (Diploma/Vocational,
 * Associate, Bachelor's, Master's, Doctorate, Other) — deliberately NOT
 * subdivided into vocational/university/college categories, since this
 * source doesn't reliably support that distinction and inventing one would
 * misclassify real institutions (e.g. Community College of Qatar, UDST).
 *
 * There is NO verified Qatar secondary-school catalog: MOEHE's own school
 * directory ("Where is my school") is a map application with no accessible
 * data endpoint (confirmed via direct lookup at implementation time — no
 * downloadable list, no discoverable API). Rather than ship an incomplete
 * third-party list (e.g. a Gulf directory site) as if it were official,
 * Secondary/High-school institution stays a plain searchable free-text
 * field in the UI — no fabricated catalog for schools.
 */
export const QATAR_HIGHER_ED_INSTITUTIONS = [
  // Public
  "Qatar University",
  "Community College of Qatar",
  "Qatar Aeronautical Academy",
  "University of Doha for Science and Technology",
  "Qatar Finance and Business Academy (with Northumbria University)",
  "Qatar Leadership Centre (with Georgetown University)",
  "Qatar Olympic Academy (with the University of Lleida, Spain)",
  // Security and military
  "Ahmed Bin Mohammed Military College",
  "Al Zaeem Mohamed Bin Abdullah Al Attiyah Air College (with Aix-Marseille University, France)",
  "Joaan Bin Jassim Academy for Defense Studies",
  "Police Academy",
  "Mohammed Bin Ghanem Al Ghanem Maritime Academy (with the University of Western Brittany, France)",
  "The Cyber Security Academy",
  // Qatar Foundation, Education City
  "Hamad Bin Khalifa University",
  "Georgetown University in Qatar",
  "Northwestern University in Qatar",
  "Virginia Commonwealth University School of Design in Qatar",
  "Texas A&M University at Qatar",
  "Carnegie Mellon University in Qatar",
  "HEC Paris, Doha",
  "Weill Cornell Medicine - Qatar",
  "Qatar Center for Professional Development",
  // Private
  "Al Rayyan International University College (with the University of Derby, UK)",
  "Doha Institute for Graduate Studies",
  "AFG College (with the University of Aberdeen, UK)",
  "University Foundation College",
  "City University Qatar (with Ulster University, UK)",
  "Oryx University (with Liverpool John Moores University, UK)",
  "Lusail University",
  "Global Studies Institute (with Arkansas State University, USA)",
  "MIE (with Savitribai Phule Pune University, India)",
  "The National University of Malaysia (UKM) in Qatar",
  "Barzan University College (with Swinburne University of Technology, Australia)",
] as const;
