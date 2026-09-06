/**
 * Static, curated multi-domain skills catalog backing the searchable
 * skills combobox. Nothing like this exists elsewhere in the repo (skills
 * are 100% free text on opportunities, AI generation, and — until this
 * change — the student profile). Flat exported array so the combobox can
 * do a simple case-insensitive substring search; grouped by comment below
 * purely for maintainability, not exported as separate arrays.
 */
export const SKILLS_CATALOG: string[] = [
  // Software & Web
  "JavaScript", "TypeScript", "Python", "Java", "C", "C++", "C#", "Go", "Rust", "Swift",
  "Kotlin", "PHP", "Ruby", "React", "Next.js", "Vue.js", "Angular", "Svelte", "Node.js", "Express.js",
  "Django", "Flask", "Spring Boot", ".NET", "GraphQL", "REST APIs", "HTML", "CSS", "Tailwind CSS", "SASS/SCSS",
  "Git", "Docker", "Kubernetes", "CI/CD", "Unit Testing", "Software Architecture", "Object-Oriented Programming", "Microservices", "WebSockets", "Mobile Development",
  "iOS Development", "Android Development", "Flutter", "React Native", "Game Development", "Unity", "Unreal Engine", "Embedded Systems", "API Integration", "Version Control",
  // Data & AI
  "SQL", "NoSQL", "PostgreSQL", "MySQL", "MongoDB", "Data Analysis", "Data Visualization", "Data Cleaning", "Data Modeling", "Data Warehousing",
  "ETL", "Excel", "Power BI", "Tableau", "Google Sheets", "R", "Statistics", "Machine Learning", "Deep Learning", "Natural Language Processing",
  "Computer Vision", "Prompt Engineering", "Large Language Models", "TensorFlow", "PyTorch", "Scikit-learn", "Pandas", "NumPy", "A/B Testing", "Predictive Modeling",
  "Business Intelligence", "Big Data", "Apache Spark", "Data Pipelines", "Dashboarding",
  // Cybersecurity
  "Network Security", "Penetration Testing", "Vulnerability Assessment", "Security Auditing", "Incident Response", "Cryptography", "Identity & Access Management", "Cloud Security", "SIEM Tools", "Risk Assessment",
  "Ethical Hacking", "Compliance (ISO 27001/SOC 2)", "Firewall Configuration", "Malware Analysis",
  // Engineering
  "Mechanical Design", "AutoCAD", "SolidWorks", "CAD/CAM", "Circuit Design", "PCB Design", "MATLAB", "Structural Analysis", "Thermodynamics", "Fluid Mechanics",
  "Manufacturing Processes", "Quality Control", "Six Sigma", "Lean Manufacturing", "Project Engineering", "Electrical Systems", "Robotics", "PLC Programming", "3D Printing", "Prototyping",
  "Civil Engineering", "Structural Engineering", "Surveying", "Geotechnical Engineering", "Petroleum Engineering", "HVAC Design",
  // Design
  "UI Design", "UX Research", "UX Design", "Figma", "Adobe Photoshop", "Adobe Illustrator", "Adobe XD", "Sketch", "Wireframing", "Prototyping (Design)",
  "Interaction Design", "Design Systems", "Typography", "Visual Design", "Motion Design", "3D Modeling", "Video Editing", "Adobe Premiere Pro", "After Effects", "Branding",
  "Illustration", "Product Design", "Usability Testing", "Accessibility Design", "Print Design",
  // Marketing
  "Digital Marketing", "Social Media Marketing", "Content Marketing", "SEO", "SEM", "Email Marketing", "Marketing Strategy", "Copywriting", "Content Writing", "Brand Management",
  "Market Research", "Google Analytics", "Google Ads", "Meta Ads", "Influencer Marketing", "Campaign Management", "Marketing Automation", "Public Relations", "Growth Marketing", "Community Management",
  "Video Marketing", "Affiliate Marketing", "CRM Marketing",
  // Finance & Accounting
  "Financial Modeling", "Financial Analysis", "Budgeting", "Forecasting", "Bookkeeping", "Accounts Payable", "Accounts Receivable", "Financial Reporting", "Auditing", "Tax Preparation",
  "Cost Accounting", "QuickBooks", "SAP", "Valuation", "Investment Analysis", "Risk Management", "Corporate Finance", "IFRS/GAAP", "Payroll Processing", "Reconciliation",
  // Sales
  "Sales Strategy", "Lead Generation", "Cold Calling", "Negotiation", "Account Management", "CRM (Salesforce)", "Customer Relationship Management", "Sales Forecasting", "Business Development", "Pipeline Management",
  "Upselling", "Client Onboarding", "Sales Presentations", "Territory Management",
  // Human Resources
  "Recruitment", "Talent Acquisition", "Onboarding", "Employee Relations", "Performance Management", "HR Policy", "Compensation & Benefits", "Training & Development", "HRIS Systems", "Workforce Planning",
  "Diversity & Inclusion", "Conflict Resolution", "Interviewing",
  // Research & Writing
  "Academic Research", "Literature Review", "Survey Design", "Qualitative Research", "Quantitative Research", "Technical Writing", "Grant Writing", "Editing", "Proofreading", "Journalism",
  "Report Writing", "Data Storytelling", "Public Speaking", "Presentation Skills",
  // Operations & Project Management
  "Project Management", "Agile", "Scrum", "Kanban", "Process Improvement", "Supply Chain Management", "Inventory Management", "Logistics", "Vendor Management", "Operations Management",
  "Business Analysis", "Change Management", "Stakeholder Management", "Jira", "Trello", "Asana", "Notion", "Time Management", "Risk Assessment (Operations)", "Quality Assurance",
  // Healthcare
  "Patient Care", "Clinical Documentation", "Medical Terminology", "Electronic Health Records (EHR)", "Pharmacy Operations", "Phlebotomy", "First Aid/CPR", "Medical Coding", "Healthcare Compliance", "Public Health",
  "Nursing Fundamentals", "Laboratory Techniques", "Radiology Basics", "Patient Communication",
  // Architecture & Construction
  "Architectural Design", "Revit", "Building Information Modeling (BIM)", "Space Planning", "Construction Management", "Site Supervision", "Cost Estimation (Construction)", "Building Codes", "Sustainable Design", "Urban Planning",
  // Hospitality & Customer Service
  "Customer Service", "Guest Relations", "Front Desk Operations", "Event Planning", "Food & Beverage Service", "Hotel Management", "Reservation Systems", "Concierge Services", "Housekeeping Operations", "Tourism Management",
  // Cross-cutting / soft skills
  "Communication", "Teamwork", "Problem Solving", "Critical Thinking", "Adaptability", "Leadership", "Attention to Detail", "Creativity", "Collaboration", "Multitasking",
];
