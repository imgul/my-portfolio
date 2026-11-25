<?php

// The Laravel migration shown in "Designing the database for a school ERP".
// CI copies it into a fresh Laravel app and runs it against MySQL (see .github/workflows/sql-examples.yml).
// The tenants, students and sections tables are cut down to the columns the enrolment rules need.

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
        });

        Schema::create('students', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained();
            $table->string('name');
            $table->unique(['tenant_id', 'id']);
        });

        Schema::create('sections', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id')->constrained();
            $table->string('name');
            $table->unique(['tenant_id', 'id']);
        });

        Schema::create('enrollments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tenant_id');
            $table->foreignId('student_id');
            $table->foreignId('section_id');
            $table->date('starts_on');
            $table->date('ends_on')->nullable();
            $table->string('end_reason', 12)->nullable();

            // student_id while the row is open, NULL once it is closed
            $table->unsignedBigInteger('open_student_id')
                ->nullable()
                ->virtualAs('IF(ends_on IS NULL, student_id, NULL)');
            $table->unique(['tenant_id', 'open_student_id'], 'enrollments_one_open');

            $table->unique(['tenant_id', 'id']);
            $table->foreign(['tenant_id', 'student_id'])->references(['tenant_id', 'id'])->on('students');
            $table->foreign(['tenant_id', 'section_id'])->references(['tenant_id', 'id'])->on('sections');
        });

        // The schema builder has no CHECK constraints, so add them with a statement.
        DB::statement(<<<'SQL'
            ALTER TABLE enrollments
              ADD CONSTRAINT enrollments_dates CHECK (ends_on IS NULL OR ends_on >= starts_on),
              ADD CONSTRAINT enrollments_reason CHECK ((ends_on IS NULL) = (end_reason IS NULL))
        SQL);
    }

    public function down(): void
    {
        Schema::dropIfExists('enrollments');
        Schema::dropIfExists('sections');
        Schema::dropIfExists('students');
        Schema::dropIfExists('tenants');
    }
};
